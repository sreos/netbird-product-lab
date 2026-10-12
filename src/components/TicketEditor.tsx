"use client";

import { useId } from "react";
import type { TicketDraft } from "@/lib/ticket";
import {
  editableFromDraft,
  FIELD_LABELS,
  withEdit,
  withoutEdit,
  type ScenarioEdit,
  type TicketEdits,
  type TicketField,
} from "@/lib/ticketEdits";

interface Props {
  /** The template output (before edits). Untouched sections keep following it. */
  generated: TicketDraft;
  edits: TicketEdits | undefined;
  onEdits: (next: TicketEdits | undefined) => void;
}

const MAX_SCENARIOS = 20;
const controlClass = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted";

/**
 * Defined at module level on purpose: a component declared inside TicketEditor would get a new
 * identity on every render, remount its children on each keystroke, and drop the text cursor.
 */
function EditorSection({
  uid,
  field,
  hint,
  edited,
  onReset,
  asGroup,
  children,
}: {
  uid: string;
  field: TicketField;
  hint?: string;
  edited: boolean;
  onReset: () => void;
  /** The section holds several controls, so its title labels a group instead of a single field. */
  asGroup?: boolean;
  children: React.ReactNode;
}) {
  const labelClass = "text-sm font-semibold text-ink";
  const label = (
    <>
      {FIELD_LABELS[field]}
      {hint && <span className="ml-2 font-normal text-muted">{hint}</span>}
    </>
  );
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {asGroup ? (
          <span id={`${uid}-${field}-label`} className={labelClass}>
            {label}
          </span>
        ) : (
          <label htmlFor={`${uid}-${field}`} className={labelClass}>
            {label}
          </label>
        )}
        {edited ? (
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Edited by you</span>
            <button
              type="button"
              onClick={onReset}
              aria-label={`Reset section: ${FIELD_LABELS[field]}`}
              className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink hover:bg-surface-2"
            >
              Reset section
            </button>
          </span>
        ) : (
          <span className="text-xs text-muted">Following the template</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function TicketEditor({ generated, edits, onEdits }: Props) {
  const uid = useId();
  const current = { ...editableFromDraft(generated), ...edits };

  const set = <K extends TicketField>(field: K, value: Required<TicketEdits>[K]) =>
    onEdits(withEdit(edits, generated, field, value));
  const section = (field: TicketField) => ({
    uid,
    field,
    edited: edits?.[field] !== undefined,
    onReset: () => onEdits(withoutEdit(edits, field)),
  });

  const updateScenario = (index: number, patch: Partial<ScenarioEdit>) =>
    set(
      "qaScenarios",
      current.qaScenarios.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );

  return (
    <div className="space-y-5">
      <EditorSection {...section("title")}>
        <input
          id={`${uid}-title`}
          type="text"
          value={current.title}
          maxLength={300}
          onChange={(e) => set("title", e.target.value)}
          className={controlClass}
        />
      </EditorSection>

      <EditorSection {...section("problemStatement")} hint="(includes the draft scores; once edited it stops following them)">
        <textarea
          id={`${uid}-problemStatement`}
          rows={7}
          value={current.problemStatement}
          maxLength={4000}
          onChange={(e) => set("problemStatement", e.target.value)}
          className={controlClass}
        />
      </EditorSection>

      <EditorSection {...section("userStory")}>
        <textarea
          id={`${uid}-userStory`}
          rows={3}
          value={current.userStory}
          maxLength={4000}
          onChange={(e) => set("userStory", e.target.value)}
          className={controlClass}
        />
      </EditorSection>

      <EditorSection {...section("acceptanceCriteria")} hint="(one per line)">
        <textarea
          id={`${uid}-acceptanceCriteria`}
          rows={7}
          value={current.acceptanceCriteria}
          maxLength={4000}
          onChange={(e) => set("acceptanceCriteria", e.target.value)}
          className={controlClass}
        />
      </EditorSection>

      <EditorSection {...section("qaScenarios")} asGroup>
        <div role="group" aria-labelledby={`${uid}-qaScenarios-label`} className="space-y-3">
          {current.qaScenarios.map((s, i) => (
            <fieldset key={i} className="space-y-2 rounded-lg border border-line bg-surface-2 p-3">
              <legend className="px-1 text-sm font-semibold text-ink">Scenario {i + 1}</legend>
              <div>
                <label htmlFor={`${uid}-s${i}-title`} className="text-xs font-semibold text-muted">
                  Title
                </label>
                <input
                  id={`${uid}-s${i}-title`}
                  type="text"
                  value={s.title}
                  maxLength={300}
                  onChange={(e) => updateScenario(i, { title: e.target.value })}
                  className={controlClass}
                />
              </div>
              <div>
                <label htmlFor={`${uid}-s${i}-steps`} className="text-xs font-semibold text-muted">
                  Steps (one per line)
                </label>
                <textarea
                  id={`${uid}-s${i}-steps`}
                  rows={3}
                  value={s.steps}
                  maxLength={2000}
                  onChange={(e) => updateScenario(i, { steps: e.target.value })}
                  className={controlClass}
                />
              </div>
              <div>
                <label htmlFor={`${uid}-s${i}-expected`} className="text-xs font-semibold text-muted">
                  Expected result
                </label>
                <textarea
                  id={`${uid}-s${i}-expected`}
                  rows={2}
                  value={s.expected}
                  maxLength={2000}
                  onChange={(e) => updateScenario(i, { expected: e.target.value })}
                  className={controlClass}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  set(
                    "qaScenarios",
                    current.qaScenarios.filter((_, j) => j !== i),
                  )
                }
                className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-2"
              >
                Remove scenario {i + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={current.qaScenarios.length >= MAX_SCENARIOS}
            onClick={() => set("qaScenarios", [...current.qaScenarios, { title: "", steps: "", expected: "" }])}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
          >
            Add scenario
          </button>
        </div>
      </EditorSection>

      <EditorSection {...section("assumptions")} hint="(one per line)">
        <textarea
          id={`${uid}-assumptions`}
          rows={5}
          value={current.assumptions}
          maxLength={4000}
          onChange={(e) => set("assumptions", e.target.value)}
          className={controlClass}
        />
      </EditorSection>
    </div>
  );
}
