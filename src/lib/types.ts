export const REPOS = ["netbirdio/netbird", "netbirdio/dashboard"] as const;
export type RepoSlug = (typeof REPOS)[number];

/** A GitHub issue reduced to the fields this app needs. Pull requests are never represented. */
export interface Issue {
  /** Stable key, e.g. "netbirdio/netbird#5513". */
  id: string;
  repo: RepoSlug;
  number: number;
  title: string;
  /** From the API. Optional so hand-built issues in tests need not set it; absent means "open". */
  state?: "open" | "closed";
  /** Always rebuilt from repo + number, never taken from the API payload. */
  url: string;
  labels: string[];
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  comments: number;
  /** Untrusted user text, cleaned and length-limited. Render as plain text only. */
  body: string;
  bodyTruncated: boolean;
}

export type FeedSource = "live" | "sample";

export interface RepoStatus {
  repo: RepoSlug;
  source: FeedSource;
  /** Why the sample snapshot was used instead of live data. */
  reason?: string;
}

export interface IssueFeed {
  issues: Issue[];
  repos: RepoStatus[];
  /** When this feed was assembled (page render / revalidation time). */
  fetchedAt: string;
  sampleSnapshotDate: string;
}

/** The subset of GitHub's REST issue payload that we read. */
export interface RawIssue {
  number: number;
  title: string;
  state?: string;
  labels?: Array<string | { name?: string | null }>;
  created_at: string;
  updated_at: string;
  comments?: number;
  body?: string | null;
  /** Present when the "issue" is actually a pull request. */
  pull_request?: unknown;
}
