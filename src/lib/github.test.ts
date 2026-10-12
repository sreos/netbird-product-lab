import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRepoIssues, getIssue, getIssueFeed } from "./github";

const rawIssue = (number: number, extra: Record<string, unknown> = {}) => ({
  number,
  title: `Issue ${number}`,
  state: "open",
  labels: [{ name: "bug" }],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  comments: 1,
  body: "body",
  ...extra,
});

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" }, ...init });

const rateLimited = () =>
  new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1791831407" } });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fetchRepoIssues", () => {
  it("filters out pull requests and normalizes issues", async () => {
    const fetchMock = vi.fn(async () => json([rawIssue(1), rawIssue(2, { pull_request: { url: "x" } }), rawIssue(3)]));
    const issues = await fetchRepoIssues("netbirdio/netbird", fetchMock as unknown as typeof fetch);
    expect(issues.map((i) => i.number)).toEqual([1, 3]);
    expect(issues[0].id).toBe("netbirdio/netbird#1");
  });

  it("is read-only: only GET, never a body, and no Authorization header without a token", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json([]));
    await fetchRepoIssues("netbirdio/dashboard", fetchMock as unknown as typeof fetch);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/api\.github\.com\/repos\/netbirdio\/dashboard\/issues\?/);
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("sends the optional server-side token as a bearer header when configured", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token-not-real");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json([]));
    await fetchRepoIssues("netbirdio/netbird", fetchMock as unknown as typeof fetch);
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer test-token-not-real");
  });
});

describe("getIssueFeed fallback", () => {
  it("uses live data when GitHub responds", async () => {
    const fetchMock = vi.fn(async () => json([rawIssue(10)]));
    const feed = await getIssueFeed(fetchMock as unknown as typeof fetch);
    expect(feed.repos.every((r) => r.source === "live")).toBe(true);
    expect(feed.issues).toHaveLength(2);
  });

  it("falls back to the sample snapshot when rate limited, and says why", async () => {
    const feed = await getIssueFeed((async () => rateLimited()) as unknown as typeof fetch);
    expect(feed.repos.every((r) => r.source === "sample")).toBe(true);
    expect(feed.repos[0].reason).toMatch(/rate limit/i);
    expect(feed.issues.length).toBeGreaterThan(10);
  });

  it("falls back on network errors", async () => {
    const feed = await getIssueFeed((async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch);
    expect(feed.repos[0].reason).toMatch(/could not reach github/i);
    expect(feed.issues.length).toBeGreaterThan(10);
  });

  it("falls back independently per repository", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/netbird/") ? json([rawIssue(99)]) : new Response("{}", { status: 502 }),
    );
    const feed = await getIssueFeed(fetchMock as unknown as typeof fetch);
    expect(feed.repos.find((r) => r.repo === "netbirdio/netbird")?.source).toBe("live");
    const dash = feed.repos.find((r) => r.repo === "netbirdio/dashboard");
    expect(dash?.source).toBe("sample");
    expect(dash?.reason).toContain("502");
    expect(feed.issues.some((i) => i.id === "netbirdio/netbird#99")).toBe(true);
    expect(feed.issues.some((i) => i.repo === "netbirdio/dashboard")).toBe(true);
  });

  it("treats a non-array payload as invalid and falls back", async () => {
    const feed = await getIssueFeed((async () => json({ message: "nope" })) as unknown as typeof fetch);
    expect(feed.repos.every((r) => r.source === "sample")).toBe(true);
  });

  it("skips the network entirely in sample mode", async () => {
    vi.stubEnv("USE_SAMPLE_DATA", "1");
    const fetchMock = vi.fn();
    const feed = await getIssueFeed(fetchMock as unknown as typeof fetch);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(feed.repos.every((r) => r.source === "sample")).toBe(true);
  });
});

describe("getIssue", () => {
  it("returns the live issue when available", async () => {
    const result = await getIssue("netbirdio/netbird", 5513, (async () => json(rawIssue(5513))) as unknown as typeof fetch);
    expect(result?.source).toBe("live");
  });

  it("falls back to the snapshot for the case-study issue", async () => {
    const result = await getIssue("netbirdio/netbird", 5513, (async () => rateLimited()) as unknown as typeof fetch);
    expect(result?.source).toBe("sample");
    expect(result?.issue.number).toBe(5513);
    expect(result?.reason).toMatch(/rate limit/i);
  });

  it("returns null when neither live nor snapshot has the issue", async () => {
    expect(await getIssue("netbirdio/netbird", 1, (async () => rateLimited()) as unknown as typeof fetch)).toBeNull();
  });
});
