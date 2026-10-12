import { CATEGORIES, type Category } from "./categorize";
import { REPOS, type RepoSlug } from "./types";

/**
 * The shareable part of the triage board lives in the URL (filters, sort, selected issue).
 * Edited scores deliberately do NOT: they stay in the viewer's own browser, so a link never
 * silently overwrites someone else's work. To share a prioritized ticket, copy its Markdown.
 *
 * Everything read from the URL is untrusted input: unknown or malformed values fall back to defaults.
 */

export type CategoryFilter = Category | "all" | "uncategorized";
export type SortKey = "priority" | "updated" | "comments" | "created";

export const SORT_KEYS: readonly SortKey[] = ["priority", "updated", "comments", "created"];

export interface ViewState {
  query: string;
  repo: RepoSlug | "all";
  category: CategoryFilter;
  sort: SortKey;
  /** Explicitly selected issue id, e.g. "netbirdio/netbird#5513". */
  issueId: string | null;
  /** Active theme filter, identified by the id of its smallest member (see similarity.ts). */
  themeId: string | null;
}

export const DEFAULT_VIEW: ViewState = {
  query: "",
  repo: "all",
  category: "all",
  sort: "priority",
  issueId: null,
  themeId: null,
};

const MAX_QUERY_LENGTH = 200;

/** "netbirdio/netbird#5513" -> "netbird-5513" */
export function issueKey(issueId: string): string {
  const match = /^netbirdio\/([a-z-]+)#(\d+)$/.exec(issueId);
  return match ? `${match[1]}-${match[2]}` : issueId;
}

/** "netbird-5513" -> "netbirdio/netbird#5513", or null when the repo is not one we load. */
export function parseIssueKey(key: string): string | null {
  const match = /^([a-z-]+)-(\d{1,9})$/.exec(key);
  if (!match) return null;
  const repo = REPOS.find((r) => r === `netbirdio/${match[1]}`);
  return repo ? `${repo}#${Number(match[2])}` : null;
}

export function parseView(search: string): ViewState {
  const params = new URLSearchParams(search);

  const repoParam = params.get("repo");
  const repo = REPOS.find((r) => r === `netbirdio/${repoParam}`) ?? "all";

  const catParam = params.get("cat");
  const category: CategoryFilter =
    catParam === "uncategorized" || (CATEGORIES as readonly string[]).includes(catParam ?? "")
      ? (catParam as CategoryFilter)
      : "all";

  const sortParam = params.get("sort");
  const sort = SORT_KEYS.find((s) => s === sortParam) ?? "priority";

  return {
    query: (params.get("q") ?? "").slice(0, MAX_QUERY_LENGTH),
    repo,
    category,
    sort,
    issueId: parseIssueKey(params.get("issue") ?? ""),
    themeId: parseIssueKey(params.get("theme") ?? ""),
  };
}

/** Returns "" for the default view, otherwise "?key=value&…" with defaults omitted. */
export function serializeView(view: ViewState): string {
  const params = new URLSearchParams();
  if (view.query.trim() !== "") params.set("q", view.query.slice(0, MAX_QUERY_LENGTH));
  if (view.repo !== DEFAULT_VIEW.repo) params.set("repo", view.repo.split("/")[1]);
  if (view.category !== DEFAULT_VIEW.category) params.set("cat", view.category);
  if (view.sort !== DEFAULT_VIEW.sort) params.set("sort", view.sort);
  if (view.themeId) params.set("theme", issueKey(view.themeId));
  if (view.issueId) params.set("issue", issueKey(view.issueId));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
