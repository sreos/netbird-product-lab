import { cleanBody } from "./text";
import type { RepoSlug } from "./types";

/** The subset of GitHub's issue-comment payload that we read. */
export interface RawComment {
  id: number;
  body?: string | null;
  created_at: string;
  author_association?: string;
  user?: { type?: string } | null;
}

export type Association =
  | "owner"
  | "member"
  | "collaborator"
  | "contributor"
  | "first-timer"
  | "first-time-contributor"
  | "mannequin"
  | "none";

const ASSOCIATIONS: readonly Association[] = [
  "owner",
  "member",
  "collaborator",
  "contributor",
  "first-timer",
  "first-time-contributor",
  "mannequin",
  "none",
];

/** Authors GitHub classifies as part of the project team. */
const TEAM: ReadonlySet<Association> = new Set(["owner", "member", "collaborator"]);

/**
 * A comment reduced to what a triage needs. Commenters' usernames are deliberately NOT carried over:
 * the role (team or community), the date, and a link to the original are enough to read the thread,
 * and they keep personal data out of this app.
 */
export interface IssueComment {
  id: number;
  association: Association;
  /** Owner, member, or collaborator according to GitHub (a fact from GitHub, not an inference). */
  team: boolean;
  bot: boolean;
  createdAt: string;
  url: string;
  /** Untrusted user text, cleaned and length-limited. Render as plain text only. */
  body: string;
  bodyTruncated: boolean;
}

const MAX_COMMENT_CHARS = 1500;

export function normalizeComment(raw: RawComment, repo: RepoSlug, issueNumber: number): IssueComment | null {
  if (!raw || typeof raw.id !== "number" || Number.isNaN(Date.parse(raw.created_at))) return null;
  const assoc = (raw.author_association ?? "NONE").toLowerCase().replace(/_/g, "-");
  const association = (ASSOCIATIONS as readonly string[]).includes(assoc) ? (assoc as Association) : "none";
  const { text, truncated } = cleanBody(raw.body, MAX_COMMENT_CHARS);
  return {
    id: raw.id,
    association,
    team: TEAM.has(association),
    bot: raw.user?.type === "Bot",
    createdAt: raw.created_at,
    url: `https://github.com/${repo}/issues/${issueNumber}#issuecomment-${raw.id}`,
    body: text,
    bodyTruncated: truncated,
  };
}

export interface DiscussionSummary {
  /** Comments that were actually loaded (a page of the thread, oldest first). */
  loaded: number;
  /** Loaded comments written by owners, members, or collaborators (bots excluded). */
  teamComments: number;
  firstTeamResponseAt: string | null;
  lastCommentAt: string | null;
}

export function summarizeDiscussion(comments: IssueComment[]): DiscussionSummary {
  const team = comments.filter((c) => c.team && !c.bot);
  const times = comments.map((c) => Date.parse(c.createdAt)).filter((t) => !Number.isNaN(t));
  const teamTimes = team.map((c) => Date.parse(c.createdAt)).filter((t) => !Number.isNaN(t));
  return {
    loaded: comments.length,
    teamComments: team.length,
    firstTeamResponseAt: teamTimes.length ? new Date(Math.min(...teamTimes)).toISOString() : null,
    lastCommentAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
  };
}

/** What the comments endpoint returns on success. */
export interface CommentsResponse {
  issue: string;
  /** Comment count GitHub reports for the whole issue. */
  total: number;
  comments: IssueComment[];
  summary: DiscussionSummary;
  fetchedAt: string;
}

export type CommentsErrorKind = "bad_request" | "not_found" | "sample_mode" | "rate_limit" | "http" | "network" | "invalid";

export interface CommentsErrorResponse {
  error: { kind: CommentsErrorKind; message: string };
}
