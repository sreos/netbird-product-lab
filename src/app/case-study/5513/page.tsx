import type { Metadata } from "next";
import Link from "next/link";
import {
  BulletCard,
  Card,
  CaseNote,
  CaseSection as Section,
  EvidenceList,
  HypothesisList,
  IssueMetadata,
  OnThisPage,
  RequirementList,
  StepList,
  type EvidenceItem,
  type Hypothesis,
  type Requirement,
} from "@/components/CaseStudyParts";
import { ConnectionStateMock } from "@/components/ConnectionStateMock";
import { TicketView } from "@/components/TicketView";
import { categorize } from "@/lib/categorize";
import { getIssue } from "@/lib/github";
import { suggestScores } from "@/lib/scoring";
import { draftTicket } from "@/lib/ticket";

export const metadata: Metadata = {
  title: "Case study: issue #5513",
  description:
    "A Technical Product Owner analysis of a public report about silent SSO session expiry: what is known, what is not, proposed requirements, and a concept mock of clearer connection states.",
};

// Same cache window as the board (see src/app/page.tsx).
export const revalidate = 900;

const ISSUE_URL = "https://github.com/netbirdio/netbird/issues/5513";

const EVIDENCE: EvidenceItem[] = [
  {
    claim:
      "After the SSO session expires, the client still shows Management and Signal as Connected, but some peers stay on “Connecting” and traffic to them stops. No re-authentication prompt appears.",
    source: "Issue description by the reporter",
    status: "Reported",
    tone: "warn",
  },
  {
    claim: "Running the client down and up again triggers a new SSO login and restores all peers.",
    source: "Issue description by the reporter",
    status: "Reported",
    tone: "warn",
  },
  {
    claim: "Self-hosted control plane with Azure AD (Entra ID) over OpenID Connect, client version 0.66.2.",
    source: "Issue description by the reporter",
    status: "Reported",
    tone: "warn",
  },
  {
    claim: "The same symptom with other identity providers (Keycloak, PocketID), on several clients.",
    source: "Two later comments from other users, with no logs or versions",
    status: "Reported by others",
    tone: "warn",
  },
  {
    claim:
      "Version 0.66.2 predates reworked session-expiry handling (0.75.0) and a relogin fix (0.76.2). The maintainer asked for a retest on 0.76.2 or later, plus diagnostics.",
    source: "Maintainer comment, 12 Oct 2026",
    status: "Maintainer statement",
    tone: "accent",
  },
  {
    claim: "The problem still occurs on 0.76.2 or later.",
    source: "Nobody has reported this yet",
    status: "Unknown",
    tone: "danger",
  },
];

const HYPOTHESES: Hypothesis[] = [
  {
    id: "H1",
    title: "Status reflects the control-plane connection, not the sign-in state",
    test: "After forcing a session to expire, compare the client's overall status, the per-peer states, and the dashboard's view of the same peer.",
  },
  {
    id: "H2",
    title: "Silent token refresh fails or is unavailable, and the failure is not surfaced",
    test: "Check whether the identity provider issues refresh tokens for this client, how long they live, and what the client logs when a refresh fails.",
  },
  {
    id: "H3",
    title: "The server side expires the peer's login while the client keeps its connections open",
    test: "Reproduce with an SSO-enrolled peer and with a setup-key peer on the same version. The maintainer notes that peer expiry only affects SSO-enrolled peers, so the setup-key peer is the control.",
  },
];

const REQUIREMENTS: Requirement[] = [
  {
    id: "R1",
    priority: "Must",
    text: "When the sign-in is expired or invalid, the overall client status must not read as plain “Connected”. It shows a distinct “Sign-in required” state.",
    why: "Removes the silent failure at the heart of the report (H1).",
    verify: "Expire a session in a test environment; assert the status output and the UI headline both change within the agreed time bound.",
  },
  {
    id: "R2",
    priority: "Must",
    text: "Peers that cannot be reached because of an expired sign-in show a specific reason, not a generic “Connecting”.",
    why: "Points users at the cause instead of sending them to debug networking.",
    verify: "Peer list shows “Waiting for sign-in” for exactly the affected peers; unaffected peers keep their normal state.",
  },
  {
    id: "R3",
    priority: "Must",
    text: "Where the identity provider supports it, the client renews the session silently before it expires, and shows a transient “Refreshing” state if renewal takes noticeable time.",
    why: "Best outcome: nobody notices the expiry (H2).",
    verify: "Run across a full token lifetime with refresh enabled; no manual action and no loss of peers.",
  },
  {
    id: "R4",
    priority: "Should",
    text: "When silent renewal is impossible, interactive clients show a clear prompt with one action; the CLI prints the next command to run and exits non-zero from a status check.",
    why: "Gives a short path from detection to recovery.",
    verify: "Prompt appears once per expiry, not repeatedly; the action completes the login flow and restores peers.",
  },
  {
    id: "R5",
    priority: "Should",
    text: "Status is available in a machine-readable form (a session field in JSON output) so monitoring can alert on unattended machines.",
    why: "The report mentions servers and CI runners where nobody watches the screen.",
    verify: "A script can distinguish healthy, refreshing, and sign-in-required states without parsing prose.",
  },
  {
    id: "R6",
    priority: "Should",
    text: "Documentation explains which enrolment method suits unattended machines and what peer expiry does and does not affect.",
    why: "May resolve part of the problem with no code change.",
    verify: "A reader can choose between SSO and setup-key enrolment for a server, from one page.",
  },
  {
    id: "R7",
    priority: "Could",
    text: "The management dashboard shows “Login expired” per peer and can warn administrators before many sessions lapse at once.",
    why: "Gives administrators a fleet-level view (H3).",
    verify: "Dashboard state matches the client state for the same peer.",
  },
  {
    id: "R8",
    priority: "Must",
    text: "Debug bundles record when the session was issued, refreshed, and expired, without ever recording token values.",
    why: "Makes the next report like this one diagnosable in a single round trip.",
    verify: "Bundle contains timestamps and states; automated check proves no token strings are present.",
  },
];

const TOC = [
  ["snapshot", "What the issue says"],
  ["evidence", "Evidence and verification status"],
  ["validate", "Step 0: validate before building"],
  ["problem", "Problem framing and hypotheses"],
  ["requirements", "Proposed requirements"],
  ["mock", "Mock connection-state UX"],
  ["metrics", "Success metrics, risks, open questions"],
  ["ticket", "Ticket draft from the Lab"],
] as const;

export default async function CaseStudyPage() {
  const result = await getIssue("netbirdio/netbird", 5513);
  const issue = result?.issue;
  const categorization = issue ? categorize(issue) : null;
  const scores = issue && categorization ? suggestScores(issue, categorization, Date.now()).scores : null;
  const draft = issue && categorization && scores ? draftTicket(issue, categorization, scores) : null;

  return (
    <article className="mx-auto max-w-4xl space-y-12">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Case study 1 of 2 ·{" "}
          <Link href="/case-study" className="underline underline-offset-2">
            all case studies
          </Link>
        </p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
          Silent SSO session expiry: when “Connected” stops being true
        </h1>
        <p className="max-w-3xl text-lg text-muted">
          A worked example of turning one public bug report (
          <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer" className="font-mono text-base text-accent underline underline-offset-2">
            netbirdio/netbird#5513<span className="sr-only"> (opens in a new tab)</span>
          </a>
          ) into a product decision, requirements, and a UX concept.
        </p>
        <CaseNote>
          <strong className="text-ink">Read this first.</strong> This is an independent portfolio exercise, not affiliated with
          NetBird and not a statement about its roadmap. The analysis uses only the public issue text: NetBird&rsquo;s source code was
          not reviewed and the problem was not reproduced. Hypotheses are labelled as hypotheses, and the UX mock is a concept,
          not NetBird&rsquo;s interface.
        </CaseNote>
        <OnThisPage items={TOC} />
      </header>

      <Section id="snapshot" title="What the issue says">
        <div className="grid gap-4 md:grid-cols-2">
          <IssueMetadata result={result} capturedOn="12 Oct 2026" />
          <Card title="The user’s expectation">
            <p className="text-sm text-ink">
              The reporter expects one of three things when the sign-in lapses: the client renews it automatically, it starts a new
              login by itself, or at minimum its status says that a login is needed instead of staying on “Connected”.
            </p>
            <p className="mt-2 text-sm text-muted">
              The reporter&rsquo;s only workaround is a manual disconnect and reconnect, which does not suit unattended servers or CI
              runners.
            </p>
          </Card>
        </div>
      </Section>

      <Section
        id="evidence"
        title="Evidence and verification status"
        intro="A product decision is only as good as its inputs. Each claim is labelled with who said it and whether anyone has verified it."
      >
        <EvidenceList items={EVIDENCE} />
      </Section>

      <Section
        id="validate"
        title="Step 0: validate before building"
        intro="The newest comment changes the right first move. A maintainer says the reported version predates relevant fixes, so the first product decision is about evidence, not features."
      >
        <StepList
          steps={[
            ["Retest on 0.76.2 or later.", "Use the reporter's reproduction steps. This single result decides how much of the rest of this page is needed."],
            [
              "Collect the diagnostics the maintainer asked for.",
              "Operating system and architecture, the client version, detailed status output, and a short debug capture taken while the problem is happening. Read it before sharing: anonymizing is not full redaction.",
            ],
            ["Check the dashboard.", "Does it show the peer's login as expired, and was the peer enrolled by SSO or by a setup key?"],
          ]}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-ok-soft p-4 text-sm">
            <p className="font-semibold text-ok">If it no longer reproduces</p>
            <p className="mt-1 text-ink">
              Confirm with the reporter and close the bug. Keep R5 to R8 as a smaller backlog item about observability: can an operator
              tell, in seconds, that a client needs a new sign-in?
            </p>
          </div>
          <div className="rounded-xl border border-line bg-warn-soft p-4 text-sm">
            <p className="font-semibold text-warn">If it still reproduces</p>
            <p className="mt-1 text-ink">Use the diagnostics to choose between the hypotheses below, then schedule R1 to R4 as one release-scoped epic.</p>
          </div>
        </div>
      </Section>

      <Section
        id="problem"
        title="Problem framing and hypotheses"
        intro="Three separable problems are bundled in the report. Separating them lets the team ship the cheapest honest improvement first."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Session lifecycle", "Does the client renew or replace an expiring sign-in on its own?"],
            ["State honesty", "Does the status shown to people and scripts match reality?"],
            ["Recovery", "How quickly, and with how little effort, does a user or an unattended machine get back to healthy?"],
          ].map(([t, b]) => (
            <div key={t} className="rounded-xl border border-line bg-surface p-4">
              <p className="font-semibold text-ink">{t}</p>
              <p className="mt-1 text-sm text-muted">{b}</p>
            </div>
          ))}
        </div>
        <h3 className="pt-2 text-lg font-semibold text-ink">Hypotheses (unverified, from the outside)</h3>
        <HypothesisList items={HYPOTHESES} />
      </Section>

      <Section
        id="requirements"
        title="Proposed requirements"
        intro="Written as user-visible outcomes, not implementation. Priorities use MoSCoW and assume the problem is confirmed in Step 0."
      >
        <RequirementList items={REQUIREMENTS} />
        <BulletCard
          title="Non-goals"
          items={[
            "Redesigning authentication or changing identity-provider policies, which customers own.",
            "Forcing interactive prompts on headless machines. They need silent renewal or a different enrolment method.",
            "Shipping anything from this prototype into NetBird. It is a portfolio concept only.",
          ]}
        />
      </Section>

      <Section
        id="mock"
        title="Mock connection-state UX"
        intro="The same machine, five moments. State 1 is the behavior in the report; states 2 to 5 are the proposal. Step through them to see what changes for a person and for a script."
      >
        <ConnectionStateMock />
      </Section>

      <Section id="metrics" title="Success metrics, risks, open questions">
        <div className="grid gap-4 md:grid-cols-3">
          <BulletCard
            title="Proposed metrics"
            note="No baselines exist yet; each needs one before it can be a target."
            items={[
              "Time from session expiry to the status changing.",
              "Time from expiry to restored connectivity.",
              "Support or issue reports mentioning a stale “Connected” state.",
            ]}
          />
          <BulletCard
            title="Risks and trade-offs"
            items={[
              "Scripts may parse today’s status text; changing it needs a compatibility plan.",
              "Prompting too eagerly annoys users; too late hides the problem.",
              "Logging session details must never include tokens.",
            ]}
          />
          <BulletCard
            title="Open questions"
            items={[
              "Does it reproduce on 0.76.2 or later?",
              "Which identity providers give the client a usable expiry time and refresh token?",
              "How many affected machines are SSO-enrolled versus setup-key?",
            ]}
          />
        </div>
      </Section>

      <Section
        id="ticket"
        title="Ticket draft from the Lab"
        intro="The triage board produced this unedited, from the issue text and its suggested scores, using the fixed template. It shows the template's generic starting point; the sections above are what a human adds on top."
      >
        <p className="text-sm text-muted">
          <Link href="/?issue=netbird-5513" className="font-medium text-accent underline underline-offset-2">
            Open this issue on the triage board
          </Link>{" "}
          to adjust its scores and watch the draft update.
        </p>
        {draft ? (
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
            <TicketView draft={draft} headingLevel={3} />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-sm text-muted">
            The issue could not be loaded, so no draft was generated.
          </p>
        )}
      </Section>

      <p className="border-t border-line pt-6 text-sm text-muted">
        Next:{" "}
        <Link href="/case-study/dashboard-412" className="font-medium text-accent underline underline-offset-2">
          Case study 2: a light-theme request that stayed open for two years
        </Link>
        , a feature request with an accessibility angle and a very different shape of evidence.
      </p>
    </article>
  );
}
