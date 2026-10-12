import type { Categorization } from "./categorize";
import type { Issue } from "./types";

/**
 * Prioritization model: priority = (impact × urgency) ÷ effort, each input on a 1–5 scale.
 *
 * Every number is a PLANNING INPUT, not a measurement. The app proposes a starting point from public
 * signals (labels, wording, comment count, recency) and always records the reasons so a human can
 * judge and override it. Effort is never inferred from an issue; it needs an engineering estimate.
 */

export const SCORE_KEYS = ["impact", "urgency", "effort"] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];
export type Scores = Record<ScoreKey, number>;
export type ScoreOverrides = Partial<Scores>;

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export const SCORE_META: Record<ScoreKey, { label: string; low: string; high: string }> = {
  impact: { label: "Impact", low: "Few users, minor annoyance", high: "Many users, or a core flow is blocked" },
  urgency: { label: "Urgency", low: "Can wait for planned work", high: "Time-critical, security, or data loss" },
  effort: { label: "Effort", low: "Hours, one engineer", high: "Multi-sprint, cross-team" },
};

export const BAND_THRESHOLDS = { high: 8, medium: 3 } as const;
export type PriorityBand = "high" | "medium" | "low";
export const BAND_LABELS: Record<PriorityBand, string> = { high: "Higher", medium: "Medium", low: "Lower" };

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(value)));
}

export function priorityScore({ impact, urgency, effort }: Scores): number {
  return Math.round(((impact * urgency) / effort) * 10) / 10;
}

export function priorityBand(score: number): PriorityBand {
  if (score >= BAND_THRESHOLDS.high) return "high";
  if (score >= BAND_THRESHOLDS.medium) return "medium";
  return "low";
}

export interface ScoreSuggestion {
  scores: Scores;
  /** Why each default is what it is. Shown verbatim in the UI. */
  rationale: Record<ScoreKey, string[]>;
}

const SEVERE_SIGNAL =
  /\b(?:security|vulnerab\w*|data loss|crash\w*|panic\w*|outage|silent(?:ly)?|cannot (?:log ?in|connect)|can'?t (?:log ?in|connect))\b/i;
const DAY_MS = 24 * 60 * 60 * 1000;

export function suggestScores(
  issue: Pick<Issue, "title" | "body" | "comments" | "updatedAt">,
  categorization: Categorization,
  /** Reference time in ms. Passed in (not read from the clock) so server and client agree. */
  now: number,
): ScoreSuggestion {
  const hasCategory = (...cats: string[]) => categorization.matches.some((m) => cats.includes(m.category));
  const text = `${issue.title}\n${issue.body.slice(0, 1500)}`;

  const impactWhy = ["Starts at 2 (unknown)."];
  let impact = 2;
  if (hasCategory("bug", "reliability")) {
    impact += 1;
    impactWhy.push("+1: categorized as a bug or reliability problem (inferred).");
  }
  if (issue.comments >= 5) {
    impact += 1;
    impactWhy.push(`+1: ${issue.comments} public comments (an engagement proxy, not measured user impact).`);
  }
  if (issue.comments >= 15) {
    impact += 1;
    impactWhy.push("+1: 15 or more comments suggests many people are affected.");
  }

  const urgencyWhy = ["Starts at 2 (unknown)."];
  let urgency = 2;
  if (SEVERE_SIGNAL.test(text)) {
    urgency += 1;
    urgencyWhy.push("+1: wording suggests a severe failure mode (security, crash, outage, silent failure, cannot log in).");
  }
  if (hasCategory("bug", "reliability") && issue.comments >= 3) {
    urgency += 1;
    urgencyWhy.push("+1: a bug/reliability report that several people responded to.");
  }
  const updated = Date.parse(issue.updatedAt);
  if (Number.isFinite(updated) && now - updated <= 30 * DAY_MS) {
    urgency += 1;
    urgencyWhy.push("+1: still active (updated within 30 days).");
  }

  return {
    scores: { impact: clampScore(impact), urgency: clampScore(urgency), effort: 3 },
    rationale: {
      impact: impactWhy,
      urgency: urgencyWhy,
      effort: ["Fixed at 3 (unknown). Effort cannot be inferred from an issue; replace it with an engineering estimate."],
    },
  };
}

export function resolveScores(suggested: Scores, overrides?: ScoreOverrides): Scores {
  return {
    impact: overrides?.impact !== undefined ? clampScore(overrides.impact) : suggested.impact,
    urgency: overrides?.urgency !== undefined ? clampScore(overrides.urgency) : suggested.urgency,
    effort: overrides?.effort !== undefined ? clampScore(overrides.effort) : suggested.effort,
  };
}
