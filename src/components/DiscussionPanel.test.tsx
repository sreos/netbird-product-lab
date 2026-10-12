import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommentsResponse } from "@/lib/comments";
import type { Issue } from "@/lib/types";
import { DiscussionPanel } from "./DiscussionPanel";

const issue = (comments: number): Issue => ({
  id: "netbirdio/netbird#5513",
  repo: "netbirdio/netbird",
  number: 5513,
  title: "SSO token expiry",
  url: "https://github.com/netbirdio/netbird/issues/5513",
  labels: [],
  createdAt: "2026-03-05T14:45:36Z",
  updatedAt: "2026-10-12T11:00:22Z",
  comments,
  body: "",
  bodyTruncated: false,
});

const payload = (over: Partial<CommentsResponse> = {}): CommentsResponse => ({
  issue: "netbirdio/netbird#5513",
  total: 3,
  fetchedAt: "2026-10-12T12:00:00Z",
  comments: [
    { id: 1, association: "none", team: false, bot: false, createdAt: "2026-03-09T12:23:06Z", url: "https://github.com/netbirdio/netbird/issues/5513#issuecomment-1", body: "Probably happens with **other** SSO providers too.", bodyTruncated: false },
    { id: 2, association: "collaborator", team: true, bot: false, createdAt: "2026-10-12T11:00:22Z", url: "https://github.com/netbirdio/netbird/issues/5513#issuecomment-2", body: "Could you retest on 0.76.2?", bodyTruncated: false },
  ],
  summary: { loaded: 2, teamComments: 1, firstTeamResponseAt: "2026-10-12T11:00:22.000Z", lastCommentAt: "2026-10-12T11:00:22.000Z" },
  ...over,
});

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("DiscussionPanel", () => {
  it("does not touch the network until asked, and says why", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DiscussionPanel issue={issue(3)} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Load the discussion" })).toBeInTheDocument();
    expect(screen.getByText(/rate limit/i)).toBeInTheDocument();
    expect(screen.getByText(/Commenter names are not shown/i)).toBeInTheDocument();
  });

  it("loads comments from the server endpoint and summarizes the team response", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => respond(payload()));
    vi.stubGlobal("fetch", fetchMock);
    render(<DiscussionPanel issue={issue(3)} />);

    await user.click(screen.getByRole("button", { name: "Load the discussion" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/comments?issue=netbird-5513", expect.anything());
    const summary = await screen.findByText(/comments loaded/);
    expect(summary).toHaveTextContent(/2 comments loaded/);
    expect(summary).toHaveTextContent(/Project team comments: 1/);
    expect(summary).toHaveTextContent(/first on 12 Oct 2026/);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[1]).getByText("Project collaborator")).toBeInTheDocument();
    expect(within(items[0]).getByText("Community member")).toBeInTheDocument();
    expect(within(items[1]).getByRole("link", { name: /open on github/i })).toHaveAttribute("href", expect.stringContaining("#issuecomment-2"));
  });

  it("states plainly when the team has not responded", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(payload({ comments: [payload().comments[0]], summary: { loaded: 1, teamComments: 0, firstTeamResponseAt: null, lastCommentAt: "2026-03-09T12:23:06.000Z" } }))),
    );
    render(<DiscussionPanel issue={issue(1)} />);
    await user.click(screen.getByRole("button", { name: "Load the discussion" }));
    expect(await screen.findByText(/no team response among the loaded comments/i)).toBeInTheDocument();
  });

  it("notes when only part of a long thread was loaded", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => respond(payload({ total: 120 }))));
    render(<DiscussionPanel issue={issue(120)} />);
    await user.click(screen.getByRole("button", { name: "Load the discussion" }));
    expect(await screen.findByText(/the oldest 2 of 120/)).toBeInTheDocument();
  });

  it("renders comment text as inert plain text", async () => {
    const user = userEvent.setup();
    const hostile = payload();
    hostile.comments[0].body = '<img src=x onerror="alert(1)"> <script>alert(2)</script> **bold**';
    vi.stubGlobal("fetch", vi.fn(async () => respond(hostile)));
    const { container } = render(<DiscussionPanel issue={issue(3)} />);
    await user.click(screen.getByRole("button", { name: "Load the discussion" }));
    await screen.findByText(/comments loaded/);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(2)</script>");
  });

  it("shows the server's message on failure, with retry and a GitHub link, and recovers on retry", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ error: { kind: "rate_limit", message: "GitHub API rate limit reached (resets 19:03 UTC)" } }, 429))
      .mockResolvedValueOnce(respond(payload()));
    vi.stubGlobal("fetch", fetchMock);
    render(<DiscussionPanel issue={issue(3)} />);

    await user.click(screen.getByRole("button", { name: "Load the discussion" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("rate limit reached (resets 19:03 UTC)");
    expect(within(alert).getByRole("link", { name: /read it on github/i })).toHaveAttribute("href", "https://github.com/netbirdio/netbird/issues/5513");

    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/comments loaded/)).toHaveTextContent(/2 comments loaded/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("handles a network failure and a non-JSON error response", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(new Response("<html>oops</html>", { status: 500 })));
    render(<DiscussionPanel issue={issue(3)} />);

    await user.click(screen.getByRole("button", { name: "Load the discussion" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server.");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("HTTP 500"));
  });

  it("shows no button when there is nothing to load", () => {
    render(<DiscussionPanel issue={issue(0)} />);
    expect(screen.getByText(/Nobody has commented/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load the discussion" })).not.toBeInTheDocument();
  });

  it("shows a loading state while waiting", async () => {
    const user = userEvent.setup();
    let release: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));
    render(<DiscussionPanel issue={issue(3)} />);
    await user.click(screen.getByRole("button", { name: "Load the discussion" }));
    expect(screen.getByText(/Loading comments from GitHub/)).toBeInTheDocument();
    release(respond(payload()));
    expect(await screen.findByText(/comments loaded/)).toHaveTextContent(/2 comments loaded/);
  });
});
