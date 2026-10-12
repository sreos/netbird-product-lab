import Link from "next/link";
import { DataStatusBanner } from "@/components/DataStatusBanner";
import { TriageBoard } from "@/components/TriageBoard";
import { getIssueFeed } from "@/lib/github";

// Re-generated at most every 15 minutes, so GitHub is called a handful of times per hour in total,
// not once per visitor. Must be a literal for Next; keep it equal to REVALIDATE_SECONDS in src/lib/github.ts.
export const revalidate = 900;

const STEPS = [
  { title: "Filter and categorize", body: "Bugs, reliability, UX, docs, and feature requests, with the evidence shown." },
  { title: "Prioritize transparently", body: "Editable impact, urgency, and effort. Suggestions are labelled as unverified." },
  { title: "Draft the ticket", body: "Problem, user story, acceptance criteria, and QA scenarios from a fixed template." },
];

export default async function HomePage() {
  const feed = await getIssueFeed();

  return (
    <div className="space-y-6">
      <section aria-labelledby="intro-heading" className="max-w-3xl space-y-3">
        <h1 id="intro-heading" className="text-3xl font-bold tracking-tight text-ink">
          Turn open-source feedback into backlog-ready tickets
        </h1>
        <p className="text-muted">
          A prototype of how a Technical Product Owner can triage public GitHub issues from{" "}
          <span className="font-mono text-sm text-ink">netbirdio/netbird</span> and{" "}
          <span className="font-mono text-sm text-ink">netbirdio/dashboard</span>. Read-only: nothing is ever written to GitHub.{" "}
          <Link href="/case-study/5513" className="font-medium text-accent underline underline-offset-2">
            See the case study on issue #5513
          </Link>
          .
        </p>
      </section>

      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
            >
              {i + 1}
            </span>
            <p className="text-sm text-muted">
              <strong className="block text-ink">{s.title}</strong>
              {s.body}
            </p>
          </li>
        ))}
      </ol>

      <DataStatusBanner feed={feed} />
      <TriageBoard issues={feed.issues} nowIso={feed.fetchedAt} />
    </div>
  );
}
