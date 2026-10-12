import type { Issue } from "./types";

export const CATEGORIES = ["bug", "reliability", "ux", "documentation", "feature-request"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  bug: "Bug",
  reliability: "Reliability",
  ux: "UX",
  documentation: "Documentation",
  "feature-request": "Feature request",
};

/**
 * How a category was decided:
 *  - "label": the issue carries a GitHub label we map to this category (the label is a fact; the mapping is ours).
 *  - "keyword": inferred from wording in the title/description. Treat as a suggestion.
 */
export type CategoryBasis = "label" | "keyword";

export interface CategoryMatch {
  category: Category;
  basis: CategoryBasis;
  score: number;
  /** GitHub labels that mapped to this category (facts about the issue). */
  labels: string[];
  /** Wording hits, e.g. `"stale" in title` (inferences). Only recorded when they reached the threshold. */
  keywords: string[];
}

export interface Categorization {
  primary: Category | null;
  matches: CategoryMatch[];
}

// Lower-case GitHub label names, taken from the label vocabulary of netbirdio/netbird and netbirdio/dashboard.
const LABEL_RULES: Record<Category, string[]> = {
  bug: ["bug", "inconsistency"],
  reliability: ["connection", "performance", "battery-usage"],
  ux: ["ux", "ui", "gui", "client-ui", "netbird-ui", "accessibility", "notification"],
  documentation: ["documentation", "missing-docs"],
  "feature-request": ["enhancement", "feature-request", "rfc"],
};

interface KeywordRule {
  re: RegExp;
  term: string;
}

const KEYWORD_RULES: Record<Category, KeywordRule[]> = {
  bug: [
    { re: /\b(crash(?:es|ed|ing)?|panic(?:s|ked)?)\b/i, term: "crash/panic" },
    { re: /\b(fail(?:s|ed|ing|ure)?|errors?)\b/i, term: "fail/error" },
    { re: /\b(broken|regression)\b/i, term: "broken/regression" },
    { re: /\b(?:doesn'?t|does not|won'?t|cannot|can'?t|unable to)\b|\bnot working\b/i, term: "cannot/doesn't work" },
  ],
  reliability: [
    { re: /\bstale\b/i, term: "stale" },
    { re: /\bstuck\b/i, term: "stuck" },
    { re: /\breconnect\w*/i, term: "reconnect" },
    { re: /\bdisconnect\w*/i, term: "disconnect" },
    { re: /\bretr(?:y|ies|ied)\b/i, term: "retry" },
    { re: /\bdrop(?:s|ped|ping)?\b/i, term: "dropped" },
    { re: /\b(?:unreachable|outage)\b/i, term: "unreachable/outage" },
    { re: /\bsilent(?:ly)?\b/i, term: "silently" },
    { re: /\b(?:intermittent\w*|flapping|unstable)\b/i, term: "intermittent/unstable" },
    { re: /\b(?:time[ds]? ?out|timeout)\b/i, term: "timeout" },
    { re: /\b(?:memory|rss|leak\w*)\b|\bcpu\b/i, term: "memory/cpu" },
    { re: /\b(?:hangs?|hung|dies?|died)\b/i, term: "hangs/dies" },
    { re: /\b(?:latency|sluggish)\b/i, term: "latency" },
  ],
  ux: [
    { re: /\bu[ix]\b|\bgui\b|\buser interface\b/i, term: "UI/UX" },
    { re: /\b(?:pop-?ups?|modal|button|tooltip|dropdown|selector)\b/i, term: "popup/modal/button" },
    { re: /\b(?:theme|dark mode|light mode)\b/i, term: "theme" },
    { re: /\b(?:confus\w+|unclear|intuitive)\b/i, term: "confusing/unclear" },
    { re: /\baccessib\w+/i, term: "accessibility" },
  ],
  documentation: [
    { re: /\bdocs?\b|\bdocumentation\b|\bdocumented\b/i, term: "docs" },
    { re: /\b(?:readme|typo|tutorial|how-?to)\b/i, term: "readme/typo/tutorial" },
  ],
  "feature-request": [
    { re: /\bfeature request\b|\bfeature:/i, term: "feature request" },
    { re: /\bsupport (?:for|multiple)\b/i, term: "support for" },
    { re: /^(?:add|allow|enable|support|publish|provide|implement)\b/i, term: "starts with add/allow/enable…" },
    { re: /\b(?:would be (?:nice|great|useful)|please add|proposal|enhancement)\b/i, term: "would be nice/proposal" },
  ],
};

const LABEL_SCORE = 5;
/** Keyword hits only count as a category when their combined weight reaches this (title hit = 2, description hit = 1). */
const KEYWORD_THRESHOLD = 2;
/** Long logs in descriptions cause false positives, so keyword matching only looks at the start. */
const BODY_WINDOW = 1500;

export function categorize(input: Pick<Issue, "title" | "labels" | "body">): Categorization {
  const labels = input.labels.map((l) => l.toLowerCase());
  const bodyHead = input.body.slice(0, BODY_WINDOW);
  const matches: CategoryMatch[] = [];

  for (const category of CATEGORIES) {
    const labelEvidence: string[] = [];
    let score = 0;

    for (const label of LABEL_RULES[category]) {
      if (labels.includes(label)) {
        labelEvidence.push(label);
        score += LABEL_SCORE;
      }
    }

    let keywordScore = 0;
    const keywordEvidence: string[] = [];
    for (const { re, term } of KEYWORD_RULES[category]) {
      if (re.test(input.title)) {
        keywordScore += 2;
        keywordEvidence.push(`"${term}" in title`);
      } else if (re.test(bodyHead)) {
        keywordScore += 1;
        keywordEvidence.push(`"${term}" in description`);
      }
    }
    const keywordsQualify = keywordScore >= KEYWORD_THRESHOLD;
    if (keywordsQualify) score += keywordScore;

    if (score > 0) {
      matches.push({
        category,
        basis: labelEvidence.length > 0 ? "label" : "keyword",
        score,
        labels: labelEvidence,
        keywords: keywordsQualify ? keywordEvidence : [],
      });
    }
  }

  matches.sort((a, b) => b.score - a.score || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
  return { primary: matches[0]?.category ?? null, matches };
}
