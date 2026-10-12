"use client";

import { useEffect, useRef, useState } from "react";
import type { CommentsErrorResponse, CommentsResponse, IssueComment } from "@/lib/comments";
import { formatDate } from "@/lib/text";
import type { Issue } from "@/lib/types";
import { issueKey } from "@/lib/urlState";
import { PlainText } from "./PlainText";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: CommentsResponse }
  | { status: "error"; message: string };

const PREVIEW_CHARS = 500;

const ROLE_LABEL: Record<string, string> = {
  owner: "Project owner",
  member: "Project member",
  collaborator: "Project collaborator",
  contributor: "Contributor",
  "first-timer": "First-time commenter",
  "first-time-contributor": "First-time contributor",
};

function roleLabel(c: IssueComment): string {
  if (c.bot) return "Bot";
  return ROLE_LABEL[c.association] ?? "Community member";
}

function CommentCard({ comment }: { comment: IssueComment }) {
  const [expanded, setExpanded] = useState(false);
  const long = comment.body.length > PREVIEW_CHARS;
  const text = expanded || !long ? comment.body : `${comment.body.slice(0, PREVIEW_CHARS).trimEnd()}…`;
  return (
    <li className="rounded-lg border border-line bg-surface p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            comment.team && !comment.bot ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"
          }`}
        >
          {roleLabel(comment)}
        </span>
        <span className="text-xs text-muted">{formatDate(comment.createdAt)}</span>
        <a
          href={comment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-accent underline underline-offset-2"
        >
          Open on GitHub<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      {comment.body ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-ink">
          <PlainText text={text} />
        </p>
      ) : (
        <p className="mt-2 text-muted">(No text.)</p>
      )}
      {(long || comment.bodyTruncated) && (
        <div className="mt-1 flex flex-wrap gap-3 text-xs">
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="font-medium text-accent underline underline-offset-2"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
          {comment.bodyTruncated && <span className="text-muted">Shortened by this app. Read the rest on GitHub.</span>}
        </div>
      )}
    </li>
  );
}

export function DiscussionPanel({ issue }: { issue: Issue }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  // Cancel an in-flight request if the panel goes away (e.g. another issue is selected).
  useEffect(() => () => controller.current?.abort(), []);

  async function load() {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/comments?issue=${encodeURIComponent(issueKey(issue.id))}`, { signal: ctrl.signal });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (json as CommentsErrorResponse | null)?.error?.message ?? `The server responded with HTTP ${res.status}.`;
        setState({ status: "error", message });
        return;
      }
      setState({ status: "ready", data: json as CommentsResponse });
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setState({ status: "error", message: "Could not reach the server." });
    }
  }

  const headingId = `discussion-h-${issue.id}`;

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="text-base font-semibold text-ink">
        Discussion <span className="text-sm font-normal text-muted">({issue.comments} comments on GitHub)</span>
      </h3>

      {issue.comments === 0 && (
        <p className="text-sm text-muted">Nobody has commented on this issue yet.</p>
      )}

      {issue.comments > 0 && state.status === "idle" && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={load}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-2"
          >
            Load the discussion
          </button>
          <p className="text-xs text-muted">
            Loaded only when you ask, to stay within GitHub&rsquo;s rate limit. Commenter names are not shown; each comment links to
            the original.
          </p>
        </div>
      )}

      <div role="status" aria-live="polite">
        {state.status === "loading" && <p className="text-sm text-muted">Loading comments from GitHub…</p>}
      </div>

      {state.status === "error" && (
        <div role="alert" className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm text-warn">
          <p>
            <span aria-hidden="true">▲ </span>
            {state.message}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={load} className="font-medium underline underline-offset-2">
              Try again
            </button>
            <a href={issue.url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
              Read it on GitHub<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      )}

      {state.status === "ready" && (
        <div className="space-y-3">
          <p className="rounded-lg border border-line bg-surface p-3 text-sm text-ink">
            <strong>{state.data.summary.loaded}</strong> comment{state.data.summary.loaded === 1 ? "" : "s"} loaded
            {state.data.total > state.data.summary.loaded && (
              <span className="text-muted"> (the oldest {state.data.summary.loaded} of {state.data.total}; read the rest on GitHub)</span>
            )}
            . Project team comments: <strong>{state.data.summary.teamComments}</strong>
            {state.data.summary.firstTeamResponseAt && (
              <>
                , first on <strong>{formatDate(state.data.summary.firstTeamResponseAt)}</strong>
              </>
            )}
            {state.data.summary.teamComments === 0 && <span className="text-muted"> (no team response among the loaded comments)</span>}
            . <span className="text-muted">Team means owner, member, or collaborator according to GitHub.</span>
          </p>
          {state.data.comments.length === 0 ? (
            <p className="text-sm text-muted">GitHub returned no comments.</p>
          ) : (
            <ul className="space-y-2">
              {state.data.comments.map((c) => (
                <CommentCard key={c.id} comment={c} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
