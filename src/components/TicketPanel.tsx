"use client";

import { useMemo, useState } from "react";
import type { Categorization } from "@/lib/categorize";
import type { Scores } from "@/lib/scoring";
import { draftTicket, ticketToMarkdown } from "@/lib/ticket";
import type { Issue } from "@/lib/types";
import { TicketView } from "./TicketView";

interface Props {
  issue: Issue;
  categorization: Categorization;
  scores: Scores;
}

export function TicketPanel({ issue, categorization, scores }: Props) {
  const draft = useMemo(() => draftTicket(issue, categorization, scores), [issue, categorization, scores]);
  const markdown = useMemo(() => ticketToMarkdown(draft, issue), [draft, issue]);
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
            Generated from a fixed template (no AI). It updates as you edit the scores. Treat it as a starting point.
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Copy as Markdown
        </button>
      </div>
      <p role="status" className="min-h-5 text-sm text-ok">
        {status}
      </p>
      <div className="rounded-lg border border-line bg-surface p-4">
        <TicketView draft={draft} />
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
