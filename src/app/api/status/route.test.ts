import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/github")>();
  return { ...actual, getRateLimitStatus: vi.fn() };
});

import { getRateLimitStatus, GitHubError } from "@/lib/github";
import { GET } from "./route";

const mocked = vi.mocked(getRateLimitStatus);
const status = (over = {}) => ({
  tokenConfigured: true,
  tokenAccepted: true,
  limit: 5000,
  remaining: 4999,
  resetsAt: "2026-10-12T20:00:00.000Z",
  ...over,
});

// Braces matter: a hook that returns a function is treated by Vitest as a cleanup callback and called after the test.
beforeEach(() => {
  mocked.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/status", () => {
  it("reports the token state and the live rate limit, briefly cacheable", async () => {
    vi.stubEnv("GITHUB_TOKEN", "set-but-not-shown");
    mocked.mockResolvedValue(status());
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=30");
    expect(await res.json()).toEqual({ sampleMode: false, tokenConfigured: true, github: status() });
  });

  it("never exposes the token value", async () => {
    vi.stubEnv("GITHUB_TOKEN", "super-secret-value-123");
    mocked.mockResolvedValue(status());
    const text = await (await GET()).text();
    expect(text).not.toContain("super-secret-value-123");
  });

  it("shows an anonymous server honestly", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    mocked.mockResolvedValue(status({ tokenConfigured: false, tokenAccepted: null, limit: 60, remaining: 12 }));
    const body = await (await GET()).json();
    expect(body.tokenConfigured).toBe(false);
    expect(body.github).toMatchObject({ limit: 60, tokenAccepted: null });
  });

  it("makes no GitHub call in sample mode", async () => {
    vi.stubEnv("USE_SAMPLE_DATA", "1");
    const res = await GET();
    expect(await res.json()).toEqual({ sampleMode: true, tokenConfigured: false, github: null });
    expect(mocked).not.toHaveBeenCalled();
  });

  it("returns 502 with the reason, uncached, when GitHub cannot be read", async () => {
    mocked.mockRejectedValue(new GitHubError("network", "Could not reach GitHub (network error or timeout)"));
    const res = await GET();
    expect(res.status).toBe(502);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await res.json()).error.message).toMatch(/could not reach github/i);
  });

  it("does not leak internal error details", async () => {
    mocked.mockRejectedValue(new Error("secret internal detail"));
    const res = await GET();
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("secret internal detail");
  });
});
