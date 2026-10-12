import type { TicketDraft } from "@/lib/ticket";
import type { TicketField } from "@/lib/ticketEdits";

interface Props {
  draft: TicketDraft;
  headingLevel?: 3 | 4;
  /** Sections the user has edited; they get an "Edited by you" badge. */
  editedFields?: ReadonlySet<TicketField>;
}

function SectionHeading({ level, edited, children }: { level: 3 | 4; edited: boolean; children: React.ReactNode }) {
  const H = `h${level}` as "h3" | "h4";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <H className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</H>
      {edited && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Edited by you</span>}
    </div>
  );
}

/** Presentational and hook-free, so it renders in both server and client components. */
export function TicketView({ draft, headingLevel = 4, editedFields }: Props) {
  const heading = (field: TicketField, text: string) => (
    <SectionHeading level={headingLevel} edited={editedFields?.has(field) ?? false}>
      {text}
    </SectionHeading>
  );

  return (
    <div className="space-y-5 text-sm">
      <div>
        {heading("title", "Ticket title")}
        <p className="mt-1 font-semibold text-ink">{draft.title}</p>
      </div>

      <div>
        {heading("problemStatement", "Problem statement")}
        <div className="mt-1 space-y-2 text-ink">
          {draft.problemStatement.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>

      <div>
        {heading("userStory", "User story")}
        <p className="mt-1 text-ink">{draft.userStory}</p>
      </div>

      <div>
        {heading("acceptanceCriteria", "Acceptance criteria")}
        <ul className="mt-1 space-y-1.5">
          {draft.acceptanceCriteria.map((c, i) => (
            <li key={`${i}-${c}`} className="flex gap-2 text-ink">
              <span aria-hidden="true" className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded border border-line bg-surface-2" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        {heading("qaScenarios", "QA test scenarios")}
        <ol className="mt-1 space-y-3">
          {draft.qaScenarios.map((s, i) => (
            <li key={`${i}-${s.title}`} className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="font-semibold text-ink">{s.title}</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-ink">
                {s.steps.map((step, n) => (
                  <li key={`${n}-${step}`}>{step}</li>
                ))}
              </ol>
              {s.expected && (
                <p className="mt-1.5 text-muted">
                  <span className="font-semibold text-ink">Expected: </span>
                  {s.expected}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div>
        {heading("assumptions", "Assumptions and open questions")}
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
          {draft.assumptions.map((a, i) => (
            <li key={`${i}-${a}`}>{a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
