import type { Categorization } from "@/lib/categorize";
import { BAND_LABELS, priorityBand, priorityScore, type Scores } from "@/lib/scoring";
import { formatDate } from "@/lib/text";
import type { Issue } from "@/lib/types";
import { issueKey } from "@/lib/urlState";
import { CategoryBadge, GitHubLabel } from "./CategoryBadge";

interface Props {
  issue: Issue;
  categorization: Categorization;
  scores: Scores;
  edited: boolean;
  selected: boolean;
  onSelect: () => void;
}

const BAND_TONE = {
  high: "bg-danger-soft text-danger",
  medium: "bg-warn-soft text-warn",
  low: "bg-surface-2 text-muted",
} as const;

const MAX_LABELS = 4;

export function IssueCard({ issue, categorization, scores, edited, selected, onSelect }: Props) {
  const score = priorityScore(scores);
  const band = priorityBand(score);
  const shortRepo = issue.repo.split("/")[1];

  return (
    <article
      id={`issue-${issueKey(issue.id)}`}
      className={`scroll-mt-4 rounded-xl border bg-surface p-4 transition-colors ${
        selected ? "border-accent ring-1 ring-accent" : "border-line hover:border-muted"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[0.95rem] font-semibold leading-snug text-ink">
          <button
            type="button"
            onClick={onSelect}
            aria-current={selected ? "true" : undefined}
            className="text-left hover:underline"
          >
            {issue.title}
          </button>
        </h3>
        <div className={`shrink-0 rounded-md px-2 py-1 text-center ${BAND_TONE[band]}`}>
          <p className="text-[10px] font-semibold uppercase leading-none tracking-wide">{BAND_LABELS[band]}</p>
          <p className="mt-0.5 text-sm font-bold leading-none tabular-nums">
            {score.toFixed(1)}
            <span className="sr-only"> priority score{edited ? ", edited by you" : ""}</span>
          </p>
        </div>
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
        <span className="font-mono">
          {shortRepo}#{issue.number}
        </span>
        <span>Created {formatDate(issue.createdAt)}</span>
        <span>{issue.comments} comments</span>
        {edited && <span className="font-semibold text-accent">Scores edited</span>}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {categorization.matches.length === 0 ? (
          <span className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted">Uncategorized</span>
        ) : (
          categorization.matches.map((m) => <CategoryBadge key={m.category} category={m.category} basis={m.basis} />)
        )}
        {issue.labels.slice(0, MAX_LABELS).map((l) => (
          <GitHubLabel key={l} name={l} />
        ))}
        {issue.labels.length > MAX_LABELS && <span className="text-xs text-muted">+{issue.labels.length - MAX_LABELS}</span>}
      </div>
    </article>
  );
}
