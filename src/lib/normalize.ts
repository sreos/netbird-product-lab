import { cleanBody } from "./text";
import type { Issue, RawIssue, RepoSlug } from "./types";

/**
 * Converts one GitHub REST payload entry into our Issue shape.
 * Returns null for pull requests (the issues endpoint returns both) and for malformed entries.
 */
export function normalizeIssue(raw: RawIssue, repo: RepoSlug): Issue | null {
  if (!raw || raw.pull_request) return null;
  if (typeof raw.number !== "number" || typeof raw.title !== "string") return null;
  if (Number.isNaN(Date.parse(raw.created_at)) || Number.isNaN(Date.parse(raw.updated_at))) return null;

  const { text, truncated } = cleanBody(raw.body);
  return {
    id: `${repo}#${raw.number}`,
    repo,
    number: raw.number,
    title: raw.title.trim(),
    state: raw.state === "closed" ? "closed" : "open",
    url: `https://github.com/${repo}/issues/${raw.number}`,
    labels: (raw.labels ?? [])
      .map((l) => (typeof l === "string" ? l : (l?.name ?? "")))
      .filter((name): name is string => name.length > 0),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    comments: Number.isFinite(raw.comments) ? Number(raw.comments) : 0,
    body: text,
    bodyTruncated: truncated,
  };
}
