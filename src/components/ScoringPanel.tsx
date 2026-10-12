"use client";

import {
  BAND_LABELS,
  BAND_THRESHOLDS,
  priorityBand,
  priorityScore,
  SCORE_KEYS,
  SCORE_MAX,
  SCORE_META,
  SCORE_MIN,
  type ScoreKey,
  type ScoreOverrides,
  type ScoreSuggestion,
  type Scores,
} from "@/lib/scoring";

interface Props {
  issueId: string;
  suggestion: ScoreSuggestion;
  overrides: ScoreOverrides | undefined;
  scores: Scores;
  onChange: (key: ScoreKey, value: number) => void;
  onReset: () => void;
}

const BAND_TONE = {
  high: "bg-danger-soft text-danger",
  medium: "bg-warn-soft text-warn",
  low: "bg-surface-2 text-muted",
} as const;

export function ScoringPanel({ issueId, suggestion, overrides, scores, onChange, onReset }: Props) {
  const score = priorityScore(scores);
  const band = priorityBand(score);
  const edited = overrides ? Object.keys(overrides).length > 0 : false;

  return (
    <section aria-labelledby={`score-h-${issueId}`} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`score-h-${issueId}`} className="text-base font-semibold text-ink">
            Prioritize
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            Priority = (impact × urgency) ÷ effort. These are planning inputs, <strong className="text-ink">not facts</strong>.
          </p>
        </div>
        <div className={`rounded-lg px-3 py-2 text-right ${BAND_TONE[band]}`} aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wide">{BAND_LABELS[band]} priority (draft)</p>
          <p className="text-2xl font-bold leading-tight tabular-nums">{score.toFixed(1)}</p>
        </div>
      </div>

      <div className="space-y-4">
        {SCORE_KEYS.map((key) => {
          const meta = SCORE_META[key];
          const isEdited = overrides?.[key] !== undefined;
          const inputId = `score-${issueId}-${key}`;
          const helpId = `${inputId}-help`;
          return (
            <div key={key} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={inputId} className="font-semibold text-ink">
                  {meta.label}: <span className="tabular-nums">{scores[key]}</span>
                  <span className="font-normal text-muted"> / {SCORE_MAX}</span>
                </label>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isEdited ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"
                  }`}
                >
                  {isEdited ? "Edited by you" : "Suggested (inferred, unverified)"}
                </span>
              </div>
              <input
                id={inputId}
                type="range"
                min={SCORE_MIN}
                max={SCORE_MAX}
                step={1}
                value={scores[key]}
                onChange={(e) => onChange(key, Number(e.target.value))}
                aria-describedby={helpId}
                aria-valuetext={`${scores[key]} of ${SCORE_MAX}`}
                className="mt-2 w-full"
              />
              <div id={helpId} className="mt-0.5 flex justify-between gap-4 text-xs text-muted">
                <span>1 · {meta.low}</span>
                <span className="text-right">5 · {meta.high}</span>
              </div>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-muted hover:text-ink">Why is the default {suggestion.scores[key]}?</summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
                  {suggestion.rationale[key].map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <p>
          Bands: ≥ {BAND_THRESHOLDS.high} higher · ≥ {BAND_THRESHOLDS.medium} medium · below lower. Edits are saved only in this
          browser.
        </p>
        <button
          type="button"
          onClick={onReset}
          disabled={!edited}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset to suggested
        </button>
      </div>
    </section>
  );
}
