import type { TicketDraft } from "./ticket";

/**
 * Per-section edits layered on top of the generated ticket draft.
 *
 * Edits are stored as the exact text the user typed (list sections as one multi-line string).
 * Parsing into lines happens only when the final draft is built, so a controlled textarea never
 * loses a blank line or jumps the cursor while typing.
 *
 * Sections the user has not touched keep following the template (and the scores); edited sections
 * are frozen until reset. This mirrors how score overrides work.
 */

export interface ScenarioEdit {
  title: string;
  steps: string;
  expected: string;
}

export interface TicketEdits {
  title?: string;
  problemStatement?: string;
  userStory?: string;
  acceptanceCriteria?: string;
  qaScenarios?: ScenarioEdit[];
  assumptions?: string;
}

export type TicketField = keyof TicketEdits;

export const TICKET_FIELDS: readonly TicketField[] = [
  "title",
  "problemStatement",
  "userStory",
  "acceptanceCriteria",
  "qaScenarios",
  "assumptions",
];

export const FIELD_LABELS: Record<TicketField, string> = {
  title: "Ticket title",
  problemStatement: "Problem statement",
  userStory: "User story",
  acceptanceCriteria: "Acceptance criteria",
  qaScenarios: "QA test scenarios",
  assumptions: "Assumptions and open questions",
};

const LIMITS = { title: 300, text: 4000, scenarios: 20, scenarioText: 2000 } as const;

// "- item", "* item", "1. item", "- [ ] item": pasted lists should not keep their markers.
const LIST_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+/;
const CHECKBOX = /^\[[ xX]\]\s+/;

export function textToLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(LIST_MARKER, "").replace(CHECKBOX, "").trim())
    .filter((line) => line.length > 0);
}

/** The draft in the same shape as the edits, used to prefill editors and to detect "no change". */
export function editableFromDraft(draft: TicketDraft): Required<TicketEdits> {
  return {
    title: draft.title,
    problemStatement: draft.problemStatement,
    userStory: draft.userStory,
    acceptanceCriteria: draft.acceptanceCriteria.join("\n"),
    qaScenarios: draft.qaScenarios.map((s) => ({ title: s.title, steps: s.steps.join("\n"), expected: s.expected })),
    assumptions: draft.assumptions.join("\n"),
  };
}

export function applyEdits(draft: TicketDraft, edits?: TicketEdits): TicketDraft {
  if (!edits) return draft;
  const out: TicketDraft = { ...draft };
  if (edits.title !== undefined) out.title = edits.title.trim() || draft.title;
  if (edits.problemStatement !== undefined) out.problemStatement = edits.problemStatement.trim();
  if (edits.userStory !== undefined) out.userStory = edits.userStory.trim();
  if (edits.acceptanceCriteria !== undefined) out.acceptanceCriteria = textToLines(edits.acceptanceCriteria);
  if (edits.assumptions !== undefined) out.assumptions = textToLines(edits.assumptions);
  if (edits.qaScenarios !== undefined) {
    out.qaScenarios = edits.qaScenarios
      .map((s) => ({ title: s.title.trim(), steps: textToLines(s.steps), expected: s.expected.trim() }))
      // A scenario the user added but never filled in is simply left out of the draft.
      .filter((s) => s.title || s.steps.length > 0 || s.expected)
      .map((s) => ({ ...s, title: s.title || "Untitled scenario" }));
  }
  return out;
}

/**
 * Returns the edits after setting one field. If the new value equals what the template would
 * produce, the field is removed, so reverting by hand clears the "Edited" state.
 */
export function withEdit<K extends TicketField>(
  edits: TicketEdits | undefined,
  generated: TicketDraft,
  field: K,
  value: Required<TicketEdits>[K],
): TicketEdits | undefined {
  const next: Record<string, unknown> = { ...edits };
  if (JSON.stringify(value) === JSON.stringify(editableFromDraft(generated)[field])) delete next[field];
  else next[field] = value;
  return Object.keys(next).length > 0 ? (next as TicketEdits) : undefined;
}

export function withoutEdit(edits: TicketEdits | undefined, field: TicketField): TicketEdits | undefined {
  if (!edits) return undefined;
  const next = { ...edits };
  delete next[field];
  return Object.keys(next).length > 0 ? next : undefined;
}

const isString = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;

/** Validates stored data (it comes from localStorage, which anything on this origin can write). */
export function sanitizeEdits(value: unknown): TicketEdits | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const out: TicketEdits = {};
  if (isString(v.title, LIMITS.title)) out.title = v.title;
  if (isString(v.problemStatement, LIMITS.text)) out.problemStatement = v.problemStatement;
  if (isString(v.userStory, LIMITS.text)) out.userStory = v.userStory;
  if (isString(v.acceptanceCriteria, LIMITS.text)) out.acceptanceCriteria = v.acceptanceCriteria;
  if (isString(v.assumptions, LIMITS.text)) out.assumptions = v.assumptions;
  if (Array.isArray(v.qaScenarios) && v.qaScenarios.length <= LIMITS.scenarios) {
    const scenarios: ScenarioEdit[] = [];
    for (const s of v.qaScenarios) {
      const r = s as Record<string, unknown> | null;
      if (r && isString(r.title, LIMITS.title) && isString(r.steps, LIMITS.scenarioText) && isString(r.expected, LIMITS.scenarioText)) {
        scenarios.push({ title: r.title, steps: r.steps, expected: r.expected });
      }
    }
    if (scenarios.length === v.qaScenarios.length) out.qaScenarios = scenarios;
  }
  return Object.keys(out).length > 0 ? out : null;
}
