import type { ReactNode } from "react";
import { SAMPLE_SNAPSHOT_DATE } from "@/data/sample";
import type { SingleIssueResult } from "@/lib/github";
import { formatDate } from "@/lib/text";

/** Building blocks shared by the case studies. Server-compatible (no hooks). */

export function CaseSection({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6 space-y-4">
      <div>
        <h2 id={`${id}-h`} className="text-2xl font-bold tracking-tight text-ink">
          {title}
        </h2>
        {intro && <p className="mt-1 max-w-3xl text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

export function CaseNote({ children }: { children: ReactNode }) {
  return (
    <div role="note" className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
      {children}
    </div>
  );
}

export function OnThisPage({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  return (
    <nav aria-label="On this page" className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-ink">On this page</p>
      <ol className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {items.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} className="text-accent underline underline-offset-2">
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-4 ${className}`}>
      {title && <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>}
      <div className={title ? "mt-2" : ""}>{children}</div>
    </div>
  );
}

/** A titled card with a bullet list, e.g. proposed metrics, risks, open questions. */
export function BulletCard({ title, note, items }: { title: string; note?: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-sm">
      <p className="font-semibold text-ink">{title}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export type Tone = "warn" | "accent" | "danger" | "ok" | "neutral";

const TONE: Record<Tone, string> = {
  warn: "bg-warn-soft text-warn",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
  ok: "bg-ok-soft text-ok",
  neutral: "bg-surface-2 text-muted",
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>{children}</span>;
}

export interface EvidenceItem {
  claim: string;
  source: string;
  status: string;
  tone: Tone;
}

/** Every claim carries who said it and whether anyone has verified it. */
export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((e) => (
        <li key={e.claim} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={e.tone}>{e.status}</Pill>
            <span className="text-xs text-muted">{e.source}</span>
          </div>
          <p className="mt-2 text-sm text-ink">{e.claim}</p>
        </li>
      ))}
    </ul>
  );
}

export interface Hypothesis {
  id: string;
  title: string;
  test: string;
}

export function HypothesisList({ items }: { items: Hypothesis[] }) {
  return (
    <ul className="space-y-3">
      {items.map((h) => (
        <li key={h.id} className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm">
          <p className="text-ink">
            <span className="mr-2 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">{h.id}</span>
            <strong>{h.title}</strong>
          </p>
          <p className="mt-1.5 text-muted">
            <span className="font-semibold text-ink">How to test: </span>
            {h.test}
          </p>
        </li>
      ))}
    </ul>
  );
}

export type Priority = "Must" | "Should" | "Could";
const PRIORITY_TONE: Record<Priority, Tone> = { Must: "danger", Should: "warn", Could: "neutral" };

export interface Requirement {
  id: string;
  priority: Priority;
  text: string;
  why: string;
  verify: string;
}

export function RequirementList({ items }: { items: Requirement[] }) {
  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <li key={r.id} className="rounded-xl border border-line bg-surface p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-semibold">{r.id}</span>
            <Pill tone={PRIORITY_TONE[r.priority]}>{r.priority}</Pill>
          </div>
          <p className="mt-2 font-medium text-ink">{r.text}</p>
          <p className="mt-1.5 text-muted">
            <span className="font-semibold text-ink">Why: </span>
            {r.why}
          </p>
          <p className="mt-1 text-muted">
            <span className="font-semibold text-ink">Verified by: </span>
            {r.verify}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Numbered "do this first" steps. */
export function StepList({ steps }: { steps: Array<[string, string]> }) {
  return (
    <ol className="space-y-3 text-sm text-ink">
      {steps.map(([title, body], i) => (
        <li key={title} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent"
          >
            {i + 1}
          </span>
          <p>
            <strong>{title}</strong> {body}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Live metadata for the studied issue, with an honest label for where the data came from. */
export function IssueMetadata({ result, capturedOn }: { result: SingleIssueResult | null; capturedOn: string }) {
  const issue = result?.issue;
  return (
    <Card title="Live metadata">
      {issue ? (
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted">State</dt>
            <dd className="text-ink">{issue.state === "closed" ? "Closed" : "Open"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">Opened</dt>
            <dd className="text-ink">{formatDate(issue.createdAt)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">Last updated</dt>
            <dd className="text-ink">{formatDate(issue.updatedAt)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">Comments</dt>
            <dd className="text-ink">{issue.comments}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">Labels</dt>
            <dd className="font-mono text-ink">{issue.labels.join(", ") || "none"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">Data</dt>
            <dd className="text-ink">
              {result?.source === "live"
                ? "Live from GitHub (cached up to 15 minutes)"
                : `Sample snapshot from ${SAMPLE_SNAPSHOT_DATE}${result?.reason ? ` (${result.reason})` : ""}`}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted">
          Issue data is unavailable right now. The analysis below still applies to the text as captured on {capturedOn}.
        </p>
      )}
    </Card>
  );
}
