import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Issue } from "@/lib/types";

vi.mock("@/lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/github")>();
  return { ...actual, getIssueFeed: vi.fn(), fetchIssueComments: vi.fn() };
});

import { fetchIssueComments, getIssueFeed, GitHubError } from "@/lib/github";
import { GET } from "./route";

const issue = (n: number, repo: "netbirdio/netbird" | "netbirdio/dashboard" = "netbirdio/netbird"): Issue => ({
  id: `${repo}#${n}`,
  repo,
  number: n,
  title: `Issue ${n}`,
  url: `https://github.com/${repo}/issues/${n}`,
  labels: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
  comments: 3,
  body: "",
  bodyTruncated: false,
});

const call = (qs: string) => GET(new Request(`https://example.test/api/comments${qs}`));
const feed = { issues: [issue(5513), issue(412, "netbirdio/dashboard")], repos: [], fetchedAt: "x", sampleSnapshotDate: "y" };

const mockedFeed = vi.mocked(getIssueFeed);
const mockedComments = vi.mocked(fetchIssueComments);

beforeEach(() => {
  mockedFeed.mockResolvedValue(feed);
  mockedComments.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/comments", () => {
  it("rejects a missing or malformed issue parameter without touching GitHub", async () => {
    for (const qs of ["", "?issue=", "?issue=other-1", "?issue=../../etc/passwd", "?issue=netbird-1;drop", "?issue=netbird-99999999999"]) {
      const res = await call(qs);
      expect(res.status).toBe(400);
      expect((await res.json()).error.kind).toBe("bad_request");
    }
    expect(mockedComments).not.toHaveBeenCalled();
  });

  it("only serves issues that are in the loaded data, and never calls GitHub for any other number", async () => {
    const res = await call("?issue=netbird-42");
    expect(res.status).toBe(404);
    expect((await res.json()).error.kind).toBe("not_found");
    expect(mockedComments).not.toHaveBeenCalled();
  });

  it("returns normalized comments with a summary, cacheable at the edge", async () => {
    mockedComments.mockResolvedValue([
      { id: 1, association: "none", team: false, bot: false, createdAt: "2026-03-09T12:00:00Z", url: "u1", body: "me too", bodyTruncated: false },
      { id: 2, association: "collaborator", team: true, bot: false, createdAt: "2026-10-12T11:00:22Z", url: "u2", body: "please retest", bodyTruncated: false },
    ]);
    const res = await call("?issue=netbird-5513");

    expect(res.status).toBe(200);
    expect(mockedComments).toHaveBeenCalledWith("netbirdio/netbird", 5513);
    expect(res.headers.get("Cache-Control")).toMatch(/s-maxage=900/);
    const body = await res.json();
    expect(body.issue).toBe("netbirdio/netbird#5513");
    expect(body.total).toBe(3);
    expect(body.comments).toHaveLength(2);
    expect(body.summary).toMatchObject({ loaded: 2, teamComments: 1, firstTeamResponseAt: "2026-10-12T11:00:22.000Z" });
  });

  it("routes the dashboard repository correctly", async () => {
    mockedComments.mockResolvedValue([]);
    await call("?issue=dashboard-412");
    expect(mockedComments).toHaveBeenCalledWith("netbirdio/dashboard", 412);
  });

  it("maps a GitHub rate limit to 429 and other failures to 502, and never caches an error", async () => {
    mockedComments.mockRejectedValueOnce(new GitHubError("rate_limit", "GitHub API rate limit reached (resets 19:03 UTC)", 403));
    const limited = await call("?issue=netbird-5513");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Cache-Control")).toBe("no-store");
    expect((await limited.json()).error).toEqual({ kind: "rate_limit", message: "GitHub API rate limit reached (resets 19:03 UTC)" });

    mockedComments.mockRejectedValueOnce(new GitHubError("network", "Could not reach GitHub (network error or timeout)"));
    const down = await call("?issue=netbird-5513");
    expect(down.status).toBe(502);
    expect(down.headers.get("Cache-Control")).toBe("no-store");
  });

  it("turns an unexpected exception into a generic 500 without leaking details", async () => {
    mockedComments.mockRejectedValueOnce(new Error("secret internal detail"));
    const res = await call("?issue=netbird-5513");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret internal detail");
  });

  it("does not call GitHub at all in sample mode", async () => {
    vi.stubEnv("USE_SAMPLE_DATA", "1");
    const res = await call("?issue=netbird-5513");
    expect(res.status).toBe(503);
    expect((await res.json()).error.kind).toBe("sample_mode");
    expect(mockedComments).not.toHaveBeenCalled();
  });
});
