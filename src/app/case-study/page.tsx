import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Case studies",
  description: "Two worked examples of turning public open-source feedback into product decisions: one bug report and one long-running feature request.",
};

const STUDIES = [
  {
    href: "/case-study/5513",
    ref: "netbirdio/netbird#5513",
    kind: "Bug report",
    title: "Silent SSO session expiry: when “Connected” stops being true",
    summary:
      "A report whose evidence is thin and possibly out of date. The first move is to find out whether the problem still happens, then separate session lifecycle, state honesty, and recovery.",
    shows: ["Evidence ledger", "Validate first", "Hypotheses", "Requirements R1 to R8", "Connection-state mock"],
  },
  {
    href: "/case-study/dashboard-412",
    ref: "netbirdio/dashboard#412",
    kind: "Feature request",
    title: "A light theme request open for two years",
    summary:
      "A need nobody doubts and a decision nobody can see. Clear demand, an accessibility angle, two community pull requests, and 25 months without a visible decision.",
    shows: ["Verified timeline", "Demand versus decision", "Options with a recommendation", "Contrast explorer", "What the triage board cannot see"],
  },
] as const;

export default function CaseStudiesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section aria-labelledby="cs-h" className="space-y-3">
        <h1 id="cs-h" className="text-3xl font-bold tracking-tight text-ink">
          Case studies
        </h1>
        <p className="max-w-3xl text-muted">
          Two public issues from NetBird&rsquo;s open-source repositories, analysed the way a Technical Product Owner would: what is
          known, what is only claimed, what to check first, and what to build. They were chosen to differ: one is a bug whose
          existence is in doubt, the other a feature request whose demand is not.
        </p>
      </section>

      <ul className="grid gap-4 md:grid-cols-2">
        {STUDIES.map((s) => (
          <li key={s.href} className="flex flex-col rounded-xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">{s.kind}</p>
            <h2 className="mt-1 text-lg font-bold leading-snug text-ink">
              <Link href={s.href} className="hover:underline">
                {s.title}
              </Link>
            </h2>
            <p className="mt-1 font-mono text-xs text-muted">{s.ref}</p>
            <p className="mt-2 text-sm text-muted">{s.summary}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {s.shows.map((x) => (
                <li key={x} className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
                  {x}
                </li>
              ))}
            </ul>
            <Link href={s.href} className="mt-4 text-sm font-semibold text-accent underline underline-offset-2">
              Read the case study
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="method-h" className="rounded-xl border border-line bg-surface p-5">
        <h2 id="method-h" className="text-base font-semibold text-ink">
          How these are written
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Every claim in the evidence ledger says who made it and whether it was verified.</li>
          <li>Facts, statements by others, and the analysis&rsquo;s own hypotheses are labelled differently and never blended.</li>
          <li>Step 0 is always &ldquo;validate before building&rdquo;, because the cheapest mistake to avoid is building the wrong thing.</li>
          <li>The analysis uses only public information. Neither study reviews NetBird&rsquo;s code, and both are independent of NetBird.</li>
        </ul>
      </section>
    </div>
  );
}
