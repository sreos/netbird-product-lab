import type { TicketDraft } from "@/lib/ticket";

/** Presentational and hook-free, so it renders in both server and client components. */
export function TicketView({ draft, headingLevel = 4 }: { draft: TicketDraft; headingLevel?: 3 | 4 }) {
  const H = `h${headingLevel}` as "h3" | "h4";
  const h = "text-sm font-semibold uppercase tracking-wide text-muted";
  return (
    <div className="space-y-5 text-sm">
      <div>
        <H className={h}>Ticket title</H>
        <p className="mt-1 font-semibold text-ink">{draft.title}</p>
      </div>

      <div>
        <H className={h}>Problem statement</H>
        <div className="mt-1 space-y-2 text-ink">
          {draft.problemStatement.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>

      <div>
        <H className={h}>User story</H>
        <p className="mt-1 text-ink">{draft.userStory}</p>
      </div>

      <div>
        <H className={h}>Acceptance criteria</H>
        <ul className="mt-1 space-y-1.5">
          {draft.acceptanceCriteria.map((c) => (
            <li key={c} className="flex gap-2 text-ink">
              <span aria-hidden="true" className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded border border-line bg-surface-2" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <H className={h}>QA test scenarios</H>
        <ol className="mt-1 space-y-3">
          {draft.qaScenarios.map((s) => (
            <li key={s.title} className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="font-semibold text-ink">{s.title}</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-ink">
                {s.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="mt-1.5 text-muted">
                <span className="font-semibold text-ink">Expected: </span>
                {s.expected}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <H className={h}>Assumptions and open questions</H>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
          {draft.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
