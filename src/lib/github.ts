import "server-only";

import { getSampleIssues, SAMPLE_SNAPSHOT_DATE } from "@/data/sample";
import { normalizeIssue } from "./normalize";
import { REPOS, type FeedSource, type Issue, type IssueFeed, type RawIssue, type RepoSlug, type RepoStatus } from "./types";

// Read-only by construction: this module only ever issues GET requests to api.github.com,
// and it runs on the server, so the optional GITHUB_TOKEN can never reach the browser.

const API_ROOT = "https://api.github.com";
/** Keep in sync with `export const revalidate` in src/app/page.tsx (Next requires a literal there). */
export const REVALIDATE_SECONDS = 900;
const PER_PAGE = 60;
const TIMEOUT_MS = 8000;

export type GitHubErrorKind = "rate_limit" | "http" | "network" | "invalid";

export class GitHubError extends Error {
  constructor(
    public readonly kind: GitHubErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

async function githubGet(path: string, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "netbird-product-lab-portfolio-prototype",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetchImpl(`${API_ROOT}${path}`, {
      method: "GET",
      headers,
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new GitHubError("network", "Could not reach GitHub (network error or timeout)");
  }

  if (!res.ok) {
    const exhausted = res.headers.get("x-ratelimit-remaining") === "0" || res.headers.has("retry-after");
    if ((res.status === 403 || res.status === 429) && exhausted) {
      const reset = Number(res.headers.get("x-ratelimit-reset"));
      const when = Number.isFinite(reset) && reset > 0 ? ` (resets ${new Date(reset * 1000).toISOString().slice(11, 16)} UTC)` : "";
      throw new GitHubError("rate_limit", `GitHub API rate limit reached${when}`, res.status);
    }
    throw new GitHubError("http", `GitHub responded with HTTP ${res.status}`, res.status);
  }

  try {
    return await res.json();
  } catch {
    throw new GitHubError("invalid", "GitHub returned a response that was not valid JSON");
  }
}

export async function fetchRepoIssues(repo: RepoSlug, fetchImpl?: typeof fetch): Promise<Issue[]> {
  const json = await githubGet(
    `/repos/${repo}/issues?state=open&sort=updated&direction=desc&per_page=${PER_PAGE}`,
    fetchImpl,
  );
  if (!Array.isArray(json)) throw new GitHubError("invalid", "GitHub returned an unexpected response shape");
  return json.flatMap((raw) => {
    const issue = normalizeIssue(raw as RawIssue, repo);
    return issue ? [issue] : [];
  });
}

function reasonFrom(error: unknown): string {
  return error instanceof GitHubError ? error.message : "Unexpected error while loading GitHub data";
}

/** Live data per repository, falling back to the bundled snapshot independently for each one. */
export async function getIssueFeed(fetchImpl?: typeof fetch): Promise<IssueFeed> {
  const forceSample = process.env.USE_SAMPLE_DATA === "1";

  const perRepo = await Promise.all(
    REPOS.map(async (repo): Promise<{ issues: Issue[]; status: RepoStatus }> => {
      if (forceSample) {
        return {
          issues: getSampleIssues(repo),
          status: { repo, source: "sample", reason: "Sample mode is enabled (USE_SAMPLE_DATA=1)" },
        };
      }
      try {
        return { issues: await fetchRepoIssues(repo, fetchImpl), status: { repo, source: "live" } };
      } catch (error) {
        return { issues: getSampleIssues(repo), status: { repo, source: "sample", reason: reasonFrom(error) } };
      }
    }),
  );

  return {
    issues: perRepo.flatMap((r) => r.issues),
    repos: perRepo.map((r) => r.status),
    fetchedAt: new Date().toISOString(),
    sampleSnapshotDate: SAMPLE_SNAPSHOT_DATE,
  };
}

export interface SingleIssueResult {
  issue: Issue;
  source: FeedSource;
  reason?: string;
}

/** One issue by number: live if possible, otherwise from the snapshot, otherwise null. */
export async function getIssue(repo: RepoSlug, number: number, fetchImpl?: typeof fetch): Promise<SingleIssueResult | null> {
  let reason: string | undefined;
  if (process.env.USE_SAMPLE_DATA === "1") {
    reason = "Sample mode is enabled (USE_SAMPLE_DATA=1)";
  } else {
    try {
      const json = await githubGet(`/repos/${repo}/issues/${number}`, fetchImpl);
      const issue = normalizeIssue(json as RawIssue, repo);
      if (issue) return { issue, source: "live" };
      reason = "GitHub returned a pull request or malformed issue";
    } catch (error) {
      reason = reasonFrom(error);
    }
  }
  const fallback = getSampleIssues(repo).find((i) => i.number === number);
  return fallback ? { issue: fallback, source: "sample", reason } : null;
}
