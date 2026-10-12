"use client";

import { useState } from "react";
import type { Categorization } from "@/lib/categorize";
import type { ScoreKey, ScoreOverrides, ScoreSuggestion, Scores } from "@/lib/scoring";
import type { RelatedMatch, Theme } from "@/lib/similarity";
import { formatDate } from "@/lib/text";
import type { TicketEdits } from "@/lib/ticketEdits";
import type { Issue } from "@/lib/types";
import { issueKey } from "@/lib/urlState";
import { CategoryBadge, GitHubLabel } from "./CategoryBadge";
import { PlainText } from "./PlainText";
import { RelatedIssues } from "./RelatedIssues";
import { ScoringPanel } from "./ScoringPanel";
import { TicketPanel } from "./TicketPanel";

export interface DetailProps {
  issue: Issue;
  categorization: Categorization;
  suggestion: ScoreSuggestion;
  overrides: ScoreOverrides | undefined;
  scores: Scores;
  onScoreChange: (key: ScoreKey, value: number) => void;
  onScoreReset: () => void;
  ticketEdits: TicketEdits | undefined;
  onTicketEdits: (next: TicketEdits | undefined) => void;
  related: RelatedMatch[];
  theme: Theme | undefined;
  activeThemeId: string | null;
  lookupIssue: (issueId: string) => Issue | undefined;
  onSelectRelated: (issueId: string) => void;
  onShowTheme: (themeId: string) => void;
}

const PREVIEW_CHARS = 700;

export function IssueDetail({
  issue,
  categorization,
  suggestion,
  overrides,
  scores,
  onScoreChange,
  onScoreReset,
  ticketEdits,
  onTicketEdits,
  related,
  theme,
  activeThemeId,
  lookupIssue,
  onSelectRelated,
  onShowTheme,
}: DetailProps) {
  const [expanded, setExpanded] = useState(false);
  const [linkStatus, setLinkStatus] = useState("");
  const long = issue.body.length > PREVIEW_CHARS;

  async function copyLink() {
    try {
      // The address bar already mirrors the filters; make sure this issue is explicitly included.
      const url = new URL(window.location.href);
      url.searchParams.set("issue", issueKey(issue.id));
      url.hash = "";
      await navigator.clipboard.writeText(url.toString());
      setLinkStatus("Link copied. It restores the filters and this issue; score edits stay in each person's own browser.");
    } catch {
      setLinkStatus("Copy was blocked by the browser. Copy the address bar instead.");
    }
  }
  const shown = expanded || !long ? issue.body : `${issue.body.slice(0, PREVIEW_CHARS).trimEnd()}…`;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <a href="#issue-list" className="inline-block text-sm text-accent underline underline-offset-2 lg:hidden">
          ← Back to the issue list
        </a>
        <p className="font-mono text-xs text-muted">
          {issue.repo}#{issue.number}
        </p>
        <h2 id="detail-heading" tabIndex={-1} className="text-xl font-bold leading-snug text-ink outline-offset-4">
          {issue.title}
        </h2>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
          <div className="flex gap-1.5">
            <dt>Created</dt>
            <dd className="text-ink">{formatDate(issue.createdAt)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Updated</dt>
            <dd className="text-ink">{formatDate(issue.updatedAt)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Comments</dt>
            <dd className="text-ink">{issue.comments}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent underline underline-offset-2"
          >
            View the source on GitHub<span className="sr-only"> (opens in a new tab)</span>
            <span aria-hidden="true">↗</span>
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-md border border-line bg-surface px-2.5 py-1 text-sm font-medium text-ink hover:bg-surface-2"
          >
            Copy link to this view
          </button>
        </div>
        <p role="status" className="text-xs text-muted">
          {linkStatus}
        </p>
      </header>

      <section aria-labelledby="cat-h" className="space-y-2">
        <h3 id="cat-h" className="text-base font-semibold text-ink">
          Categories and labels
        </h3>
        {categorization.matches.length === 0 ? (
          <p className="text-sm text-muted">No category signal found. This issue stays uncategorized until a human triages it.</p>
        ) : (
          <ul className="space-y-3">
            {categorization.matches.map((m) => (
              <li key={m.category} className="space-y-1 text-sm">
                <CategoryBadge category={m.category} basis={m.basis} />
                <ul className="list-disc space-y-0.5 pl-5 text-muted">
                  {m.labels.length > 0 && (
                    <li>
                      <span className="font-medium text-ink">From GitHub {m.labels.length > 1 ? "labels" : "label"}:</span>{" "}
                      {m.labels.join(", ")}
                    </li>
                  )}
                  {m.keywords.length > 0 && (
                    <li>
                      <span className="font-medium text-ink">Inferred from wording (a suggestion):</span> {m.keywords.join("; ")}
                    </li>
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-sm text-muted">GitHub labels:</span>
          {issue.labels.length === 0 ? (
            <span className="text-sm text-muted">none</span>
          ) : (
            issue.labels.map((l) => <GitHubLabel key={l} name={l} />)
          )}
        </div>
      </section>

      <section aria-labelledby="desc-h" className="space-y-2">
        <h3 id="desc-h" className="text-base font-semibold text-ink">
          Description <span className="text-sm font-normal text-muted">(reporter&rsquo;s words, shown as plain text)</span>
        </h3>
        {issue.body ? (
          // Scrollable, so it must be reachable by keyboard.
          <pre
            tabIndex={0}
            role="region"
            aria-label="Issue description text"
            className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface p-3 font-sans text-sm text-ink"
          >
            <PlainText text={shown} />
          </pre>
        ) : (
          <p className="text-sm text-muted">The reporter did not provide a description.</p>
        )}
        {(long || issue.bodyTruncated) && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {long && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="font-medium text-accent underline underline-offset-2"
              >
                {expanded ? "Show less" : "Show full description"}
              </button>
            )}
            {issue.bodyTruncated && (
              <span className="text-muted">Long text was shortened by this app. Read the rest on GitHub.</span>
            )}
          </div>
        )}
      </section>

      <RelatedIssues
        matches={related}
        theme={theme}
        activeThemeId={activeThemeId}
        lookup={lookupIssue}
        onSelect={onSelectRelated}
        onShowTheme={onShowTheme}
      />

      <ScoringPanel
        issueId={issue.id}
        suggestion={suggestion}
        overrides={overrides}
        scores={scores}
        onChange={onScoreChange}
        onReset={onScoreReset}
      />

      <TicketPanel issue={issue} categorization={categorization} scores={scores} edits={ticketEdits} onEdits={onTicketEdits} />
    </div>
  );
}
