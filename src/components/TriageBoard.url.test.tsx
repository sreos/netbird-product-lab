import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { getSampleIssues } from "@/data/sample";
import { TriageBoard } from "./TriageBoard";

const issues = getSampleIssues();
const NOW = "2026-10-12T12:00:00Z";

const setUrl = (path: string) => window.history.replaceState(null, "", path);
const detail = () => screen.getByRole("complementary", { name: /selected issue/i });

beforeEach(() => {
  window.localStorage.clear();
  setUrl("/");
});

describe("TriageBoard URL state", () => {
  it("restores filters, sort, and the selected issue from the URL", () => {
    setUrl("/?cat=documentation&sort=updated&issue=netbird-446");
    render(<TriageBoard issues={issues} nowIso={NOW} />);

    const group = screen.getByRole("group", { name: /filter by category/i });
    expect(within(group).getByRole("button", { name: /^Documentation/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Sort by")).toHaveValue("updated");
    const expected = issues.find((i) => i.number === 446)!.title;
    expect(within(detail()).getByRole("heading", { level: 2 })).toHaveTextContent(expected);
  });

  it("restores the search text and repository filter", () => {
    setUrl("/?q=theme&repo=dashboard");
    render(<TriageBoard issues={issues} nowIso={NOW} />);
    expect(screen.getByLabelText("Search")).toHaveValue("theme");
    expect(screen.getByLabelText("Repository")).toHaveValue("netbirdio/dashboard");
    const list = screen.getByRole("list", { name: "Issues" });
    expect(within(list).getByText("Add Light Theme for Web UI")).toBeInTheDocument();
  });

  it("keeps the address bar in sync as the user filters, and leaves a clean URL for the default view", async () => {
    const user = userEvent.setup();
    render(<TriageBoard issues={issues} nowIso={NOW} />);
    expect(window.location.search).toBe("");

    await user.click(within(screen.getByRole("group", { name: /filter by category/i })).getByRole("button", { name: /^Bug/ }));
    expect(window.location.search).toBe("?cat=bug");

    await user.type(screen.getByLabelText("Search"), "sso");
    expect(window.location.search).toBe("?q=sso&cat=bug");

    await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(window.location.search).toBe("");
  });

  it("records an explicitly selected issue in the URL", async () => {
    const user = userEvent.setup();
    render(<TriageBoard issues={issues} nowIso={NOW} />);
    const second = within(screen.getByRole("list", { name: "Issues" })).getAllByRole("article")[1];
    await user.click(within(second).getByRole("button"));
    expect(window.location.search).toMatch(/^\?issue=(netbird|dashboard)-\d+$/);
  });

  it("ignores hostile or unknown parameters instead of breaking", () => {
    setUrl("/?cat=%3Cscript%3E&sort=drop&repo=evil&issue=javascript:alert(1)");
    render(<TriageBoard issues={issues} nowIso={NOW} />);
    expect(screen.getByText(`Showing ${issues.length} of ${issues.length} issues`)).toBeInTheDocument();
  });

  it("explains when a linked issue is not in the loaded data, and drops it from the URL", async () => {
    setUrl("/?issue=netbird-999999");
    render(<TriageBoard issues={issues} nowIso={NOW} />);
    const note = await screen.findByText(/is not in the loaded data/i);
    expect(note).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /netbirdio\/netbird#999999/ })).toHaveAttribute(
      "href",
      "https://github.com/netbirdio/netbird/issues/999999",
    );
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("copies a link that restores the view but carries no scores or secrets", async () => {
    const user = userEvent.setup();
    setUrl("/?cat=reliability");
    render(<TriageBoard issues={issues} nowIso={NOW} />);

    await user.click(within(detail()).getByRole("button", { name: "Copy link to this view" }));
    const copied = await navigator.clipboard.readText();
    const url = new URL(copied);
    expect(url.searchParams.get("cat")).toBe("reliability");
    expect(url.searchParams.get("issue")).toMatch(/^(netbird|dashboard)-\d+$/);
    expect([...url.searchParams.keys()].sort()).toEqual(["cat", "issue"]);
    expect(within(detail()).getByText(/link copied/i)).toBeInTheDocument();
  });
});
