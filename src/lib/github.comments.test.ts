import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMENTS_PER_PAGE, fetchIssueComments, GitHubError } from "./github";

const comment = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  body: `comment ${id}`,
  created_at: "2026-10-12T11:00:22Z",
  author_association: "NONE",
  user: { type: "User", login: "x" },
  ...extra,
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllEnvs());

describe("fetchIssueComments", () => {
  it("makes one read-only GET for the first page of comments and normalizes them", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json([comment(1), comment(2)]));
    const out = await fetchIssueComments("netbirdio/netbird", 5513, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.github.com/repos/netbirdio/netbird/issues/5513/comments?per_page=${COMMENTS_PER_PAGE}`);
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(out.map((c) => c.id)).toEqual([1, 2]);
    expect(out[0].url).toBe("https://github.com/netbirdio/netbird/issues/5513#issuecomment-1");
  });

  it("skips malformed entries instead of failing the whole thread", async () => {
    const fetchMock = vi.fn(async () => json([comment(1), { id: "bad" }, comment(3, { created_at: "nope" })]));
    const out = await fetchIssueComments("netbirdio/netbird", 1, fetchMock as unknown as typeof fetch);
    expect(out.map((c) => c.id)).toEqual([1]);
  });

  it("raises a typed error for rate limits, HTTP errors, and non-array payloads", async () => {
    const limited = new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } });
    await expect(fetchIssueComments("netbirdio/netbird", 1, (async () => limited) as unknown as typeof fetch)).rejects.toMatchObject({
      kind: "rate_limit",
    });
    await expect(fetchIssueComments("netbirdio/netbird", 1, (async () => json({}, 500)) as unknown as typeof fetch)).rejects.toMatchObject({
      kind: "http",
    });
    await expect(fetchIssueComments("netbirdio/netbird", 1, (async () => json({ message: "x" })) as unknown as typeof fetch)).rejects.toBeInstanceOf(
      GitHubError,
    );
  });
});
