import { normalizeIssue } from "@/lib/normalize";
import type { Issue, RawIssue, RepoSlug } from "@/lib/types";
import snapshot from "./sample-issues.json";

/**
 * Bundled snapshot of real public issues, used when the GitHub API is unavailable or rate limited.
 * It is stored in GitHub's own payload shape so it passes through the exact same normalizer as live data.
 */
export const SAMPLE_SNAPSHOT_DATE: string = snapshot.snapshotDate;

type SampleEntry = RawIssue & { repository: string };

export function getSampleIssues(repo?: RepoSlug): Issue[] {
  const out: Issue[] = [];
  for (const entry of snapshot.issues as SampleEntry[]) {
    if (repo && entry.repository !== repo) continue;
    const issue = normalizeIssue(entry, entry.repository as RepoSlug);
    if (issue) out.push(issue);
  }
  return out;
}
