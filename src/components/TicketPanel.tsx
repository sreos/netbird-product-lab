"use client";

import { useMemo, useState } from "react";
import type { Categorization } from "@/lib/categorize";
import type { Scores } from "@/lib/scoring";
import { draftTicket, ticketToMarkdown } from "@/lib/ticket";
import { applyEdits, FIELD_LABELS, type TicketEdits, type TicketField } from "@/lib/ticketEdits";
import type { Issue } from "@/lib/types";
import { TicketEditor } from "./TicketEditor";
import { TicketView } from "./TicketView";

interface Props {
  issue: Issue;
  categorization: Categorization;
  scores: Scores;
  edits: TicketEdits | undefined;
  onEdits: (next: TicketEdits | undefined) => void;
}

export function TicketPanel({ issue, categorization, scores, edits, onEdits }: Props) {
  const generated = useMemo(() => draftTicket(issue, categorization, scores), [issue, categorization, scores]);
  const draft = useMemo(() => applyEdits(generated, edits), [generated, edits]);
  const markdown = useMemo(() => ticketToMarkdown(draft, issue), [draft, issue]);
  const editedFields = useMemo(() => new Set(Object.keys(edits ?? {}) as TicketField[]), [edits]);

  const [editing, setEditing] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [status, setStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setStatus("Markdown copied to clipboard.");
    } catch {
      setStatus("Copy was blocked by the browser. Open “View as Markdown” and copy from there.");
    }
  }

  return (
    <section aria-labelledby={`ticket-h-${issue.id}`} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`ticket-h-${issue.id}`} className="text-base font-semibold text-ink">
            Ticket draft
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            Generated from a fixed template (no AI). Edit any section; sections you leave alone keep following your scores.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-2"
          >
            {editing ? "Done editing" : "Edit draft"}
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink hover:opacity-90"
          >
            Copy as Markdown
          </button>
        </div>
      </div>

      <p role="status" className="min-h-5 text-sm text-ok">
        {status}
      </p>

      {editedFields.size > 0 && (
        <div className="rounded-lg border border-line bg-surface p-3 text-sm">
          <p className="text-ink">
            <strong>You edited:</strong> {[...editedFields].map((f) => FIELD_LABELS[f]).join(", ")}. Those sections no longer follow the
            template. Edits are saved only in this browser.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {confirmingReset ? (
              <>
                <span className="text-muted">Discard all your edits to this draft?</span>
                <button
                  type="button"
                  onClick={() => {
                    onEdits(undefined);
                    setConfirmingReset(false);
                    setStatus("Draft regenerated from the template.");
                  }}
                  className="rounded-md bg-danger px-2.5 py-1 text-xs font-semibold text-accent-ink"
                >
                  Yes, regenerate
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-2"
                >
                  Keep my edits
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-2"
              >
                Regenerate from template
              </button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-line bg-surface p-4">
        {editing ? (
          <TicketEditor generated={generated} edits={edits} onEdits={onEdits} />
        ) : (
          <TicketView draft={draft} editedFields={editedFields} />
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">View as Markdown</summary>
        <label htmlFor={`md-${issue.id}`} className="sr-only">
          Ticket draft as Markdown
        </label>
        <textarea
          id={`md-${issue.id}`}
          readOnly
          value={markdown}
          rows={12}
          className="mt-2 w-full rounded-lg border border-line bg-surface p-3 font-mono text-xs text-ink"
        />
      </details>
    </section>
  );
}
