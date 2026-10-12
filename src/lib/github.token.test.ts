import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRepoIssues, getRateLimitStatus } from "./github";

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
const authOf = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>).Authorization;

const RESET = 1791831407;
const limits = (limit: number, remaining: number) => ({ resources: { core: { limit, remaining, reset: RESET } } });

afterEach(() => vi.unstubAllEnvs());

describe("an expired or revoked token", () => {
  it("is retried once without the token, so the site degrades to anonymous access instead of failing", async () => {
    vi.stubEnv("GITHUB_TOKEN", "expired-token-not-real");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ message: "Bad credentials" }, 401))
      .mockResolvedValueOnce(json([]));

    await expect(fetchRepoIssues("netbirdio/netbird", fetchMock as unknown as typeof fetch)).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authOf(fetchMock.mock.calls[0])).toBe("Bearer expired-token-not-real");
    expect(authOf(fetchMock.mock.calls[1])).toBeUndefined();
  });

  it("is not retried when there was no token, so a 401 is reported instead of looping", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const fetchMock = vi.fn(async () => json({}, 401));
    await expect(fetchRepoIssues("netbirdio/netbird", fetchMock as unknown as typeof fetch)).rejects.toMatchObject({ kind: "http", status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is not retried for other failures, such as a rate limit", async () => {
    vi.stubEnv("GITHUB_TOKEN", "valid-token-not-real");
    const fetchMock = vi.fn(async () => json({}, 403, { "x-ratelimit-remaining": "0" }));
    await expect(fetchRepoIssues("netbirdio/netbird", fetchMock as unknown as typeof fetch)).rejects.toMatchObject({ kind: "rate_limit" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getRateLimitStatus", () => {
  it("without a token reports the anonymous limit and makes an uncached, token-free GET", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json(limits(60, 41)));
    const status = await getRateLimitStatus(fetchMock as unknown as typeof fetch);

    expect(status).toEqual({
      tokenConfigured: false,
      tokenAccepted: null,
      limit: 60,
      remaining: 41,
      resetsAt: new Date(RESET * 1000).toISOString(),
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/rate_limit");
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("with a working token reports the higher limit and that the token was accepted", async () => {
    vi.stubEnv("GITHUB_TOKEN", "valid-token-not-real");
    const fetchMock = vi.fn(async () => json(limits(5000, 4990)));
    const status = await getRateLimitStatus(fetchMock as unknown as typeof fetch);
    expect(status).toMatchObject({ tokenConfigured: true, tokenAccepted: true, limit: 5000, remaining: 4990 });
    expect(authOf(fetchMock.mock.calls[0] as unknown[])).toBe("Bearer valid-token-not-real");
  });

  it("with a rejected token says so, and reports the anonymous limit it fell back to", async () => {
    vi.stubEnv("GITHUB_TOKEN", "expired-token-not-real");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ message: "Bad credentials" }, 401))
      .mockResolvedValueOnce(json(limits(60, 58)));
    const status = await getRateLimitStatus(fetchMock as unknown as typeof fetch);
    expect(status).toMatchObject({ tokenConfigured: true, tokenAccepted: false, limit: 60, remaining: 58 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authOf(fetchMock.mock.calls[1] as unknown[])).toBeUndefined();
  });

  it("never puts the token value in its result", async () => {
    vi.stubEnv("GITHUB_TOKEN", "super-secret-value-123");
    const status = await getRateLimitStatus((async () => json(limits(5000, 5000))) as unknown as typeof fetch);
    expect(JSON.stringify(status)).not.toContain("super-secret-value-123");
  });

  it("raises typed errors for network failures, HTTP errors, and unexpected payloads", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    await expect(
      getRateLimitStatus((async () => {
        throw new Error("boom");
      }) as unknown as typeof fetch),
    ).rejects.toMatchObject({ kind: "network" });
    await expect(getRateLimitStatus((async () => json({}, 500)) as unknown as typeof fetch)).rejects.toMatchObject({ kind: "http" });
    await expect(getRateLimitStatus((async () => json({ resources: {} })) as unknown as typeof fetch)).rejects.toMatchObject({ kind: "invalid" });
    await expect(
      getRateLimitStatus((async () => new Response("not json", { status: 200 })) as unknown as typeof fetch),
    ).rejects.toMatchObject({ kind: "invalid" });
  });
});
