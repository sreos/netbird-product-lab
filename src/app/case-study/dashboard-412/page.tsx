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
  Pill,
  RequirementList,
  StepList,
  type EvidenceItem,
  type Hypothesis,
  type Requirement,
  type Tone,
} from "@/components/CaseStudyParts";
import { ContrastExplorer } from "@/components/ContrastExplorer";
import { DiscussionPanel } from "@/components/DiscussionPanel";
import { ThemeControlMock } from "@/components/ThemeControlMock";
import { categorize } from "@/lib/categorize";
import { getIssue } from "@/lib/github";
import { suggestScores } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Case study: dashboard issue #412",
  description:
    "A Technical Product Owner analysis of a light-theme request that stayed open for two years: clear demand, no visible decision, and an accessibility angle. Evidence, options, requirements, and a concept mock.",
};

// Same cache window as the board (see src/app/page.tsx).
export const revalidate = 900;

const ISSUE_URL = "https://github.com/netbirdio/dashboard/issues/412";
const CAPTURED = "12 Oct 2026";

const EVIDENCE: EvidenceItem[] = [
  {
    claim:
      "The reporter finds the dark theme (gray on black) hard to read, says the light theme on the documentation site is readable, and notes a theme control in the top right whose Light and System options are disabled.",
    source: "Issue description by the reporter",
    status: "Reported, not measured",
    tone: "warn",
  },
  {
    claim:
      "The issue has 29 thumbs-up reactions and 22 comments over about 25 months. It is still open and still carries the label needs-triage.",
    source: "GitHub public data, read on 12 Oct 2026",
    status: "Verified (GitHub data)",
    tone: "ok",
  },
  {
    claim:
      "Several commenters give personal reasons for wanting a light theme: older eyes, astigmatism, and working in direct sunlight. This analysis does not evaluate those medical or environmental claims.",
    source: "Three comments by other users",
    status: "Reported by others",
    tone: "warn",
  },
  {
    claim:
      "None of the 22 comments comes from an account GitHub marks as owner, member, or collaborator. Three come from accounts marked “contributor” that speak about the project’s progress, which shows this signal can understate real team involvement.",
    source: "GitHub author association of each comment",
    status: "Verified, with a caveat",
    tone: "accent",
  },
  {
    claim:
      "Maintainers were asked directly in April 2025 whether the feature is wanted, and in August 2026 to review the two open pull requests. No reply from a team member is visible in the thread.",
    source: "The visible thread only; replies may exist elsewhere, for example in the pull requests",
    status: "Verified (visible thread)",
    tone: "accent",
  },
  {
    claim:
      "Community pull request #461 (“Added light/system theme”) was opened on 29 Apr 2025, changed 110 files, and was closed without merging on 27 Aug 2026, with no inline review comments.",
    source: "GitHub pull request metadata",
    status: "Verified (GitHub data)",
    tone: "ok",
  },
  {
    claim:
      "Pull request #658 (“Add Light Mode Switching”) was opened on 2 Jun 2026 and is open, with 52 commits, 176 changed files, and 19 inline review comments.",
    source: "GitHub pull request metadata",
    status: "Verified (GitHub data)",
    tone: "ok",
  },
  {
    claim:
      "The client’s light mode (netbirdio/netbird#7344) was opened by a project collaborator on 28 Aug 2026 and merged on 11 Sep 2026 after 22 inline review comments.",
    source: "GitHub pull request metadata",
    status: "Verified (GitHub data)",
    tone: "ok",
  },
  {
    claim:
      "Light mode is part of release candidate 0.79 of the client, the dashboard is next, and final touches are being made after feedback from a front-end engineer.",
    source: "Comments by accounts marked “contributor”",
    status: "Stated in a comment",
    tone: "accent",
  },
  {
    claim: "The existing dark theme fails contrast requirements.",
    source: "Nobody has measured it in the thread",
    status: "Unknown",
    tone: "danger",
  },
  {
    claim: "Why pull request #461 was closed, and what #658 still needs before it can merge.",
    source: "Not explained in the issue thread",
    status: "Unknown",
    tone: "danger",
  },
];

interface TimelineEntry {
  date: string;
  iso: string;
  text: string;
  verified: boolean;
}

const TIMELINE: TimelineEntry[] = [
  { date: "9 Sep 2024", iso: "2024-09-09", text: "Issue opened, labelled needs-triage and feature-request.", verified: true },
  {
    date: "21 Apr 2025",
    iso: "2025-04-21",
    text: "A commenter points to a community-built container image with a light-mode branch. It is third-party and was not evaluated here.",
    verified: true,
  },
  {
    date: "29 Apr 2025",
    iso: "2025-04-29",
    text: "Community pull request #461 is opened (110 files). The same week a commenter asks the maintainers whether the feature is wanted.",
    verified: true,
  },
  {
    date: "Oct 2025 to Jul 2026",
    iso: "2025-10-02",
    text: "A steady stream of short upvotes and requests for news, plus three comments giving personal reasons (older eyes, astigmatism, direct sunlight).",
    verified: true,
  },
  { date: "2 Jun 2026", iso: "2026-06-02", text: "A second pull request, #658, is opened.", verified: true },
  {
    date: "6 Aug 2026",
    iso: "2026-08-06",
    text: "A commenter asks the maintainers to look at the two open pull requests and decide how to proceed.",
    verified: true,
  },
  {
    date: "27 Aug 2026",
    iso: "2026-08-27",
    text: "Pull request #461 is closed without merging, 16 months after it was opened.",
    verified: true,
  },
  {
    date: "28 Aug to 11 Sep 2026",
    iso: "2026-08-28",
    text: "The client’s light mode is opened by a project collaborator and merged two weeks later.",
    verified: true,
  },
  {
    date: "15 to 21 Sep 2026",
    iso: "2026-09-15",
    text: "Contributors say light mode is in release candidate 0.79 and that the dashboard is next, with final touches under way.",
    verified: false,
  },
  {
    date: "8 to 9 Oct 2026",
    iso: "2026-10-08",
    text: "A commenter reports the dashboard pull request is still pending. Pull request #658 is updated the next day and remains open.",
    verified: true,
  },
];

const HYPOTHESES: Hypothesis[] = [
  {
    id: "H1",
    title: "The current dark theme has text below the accepted contrast level in places",
    test: "Run an automated contrast audit on the key screens (peers, networks, access control, settings) and review failures by hand. Measure; do not rely on anyone’s impression, including the reporter’s.",
  },
  {
    id: "H2",
    title: "What blocked the community pull requests was review and design sign-off capacity, not demand or code quality",
    test: "Read the review discussion on #658 and ask the reviewers what stands between it and a merge: design sign-off, test coverage, visual regressions, or the size of the change (176 files).",
  },
  {
    id: "H3",
    title: "A visible decision, even “not now, because X”, would have prevented much of the repeated upvote and news-request traffic",
    test: "After a decision is posted, count new comments of that kind over the following months, and compare with the rate before.",
  },
];

const REQUIREMENTS: Requirement[] = [
  {
    id: "R1",
    priority: "Must",
    text: "The theme control offers Light, Dark, and System. The choice is remembered in the browser, and System follows the device and updates when the device setting changes.",
    why: "Delivers what the visible control already promises and respects people’s system-level accessibility settings.",
    verify: "Each option works; the choice survives a reload; changing the device theme while System is selected changes the dashboard without a reload.",
  },
  {
    id: "R2",
    priority: "Must",
    text: "In both themes, text and meaningful interface parts meet WCAG 2.2 AA contrast: 4.5:1 for normal text, 3:1 for large text and interface components.",
    why: "The reporter’s need is readability. A light theme that fails contrast would repeat the problem in a different color.",
    verify: "An automated audit reports no contrast failures on the key screens in either theme, backed by a manual review of states the audit cannot reach (hover, focus, disabled).",
  },
  {
    id: "R3",
    priority: "Must",
    text: "The page never flashes the wrong theme while loading, including after a reload and on a first visit with System selected.",
    why: "A white flash before a dark page is the most visible defect a theme feature can have.",
    verify: "Record page loads in both themes and confirm that the first painted frame already uses the chosen theme.",
  },
  {
    id: "R4",
    priority: "Should",
    text: "Embedded components (charts, code blocks, the integrated SSH terminal) follow the theme, or any exception is documented.",
    why: "Third-party components are where a theme most often leaks through.",
    verify: "A checklist of every embedded component, with a screenshot in each theme.",
  },
  {
    id: "R5",
    priority: "Must",
    text: "The issue receives a visible decision: scope, owner, target release, the status of the open pull requests, and an updated label.",
    why: "After 25 months without one, the cost to trust and to triage is already larger than the cost of saying “not now”.",
    verify: "A maintainer comment exists that answers the questions asked in the thread, and the needs-triage label is replaced.",
  },
  {
    id: "R6",
    priority: "Should",
    text: "Until the feature ships, the theme control never shows options that do nothing. Hide them, or label them “not available yet” with a link to progress.",
    why: "A dead control invites the same question again and again.",
    verify: "No visible control is both enabled-looking and inert.",
  },
  {
    id: "R7",
    priority: "Should",
    text: "The default for existing users is an explicit decision, not a side effect. Proposal: keep today’s default, ship System as opt-in, and revisit the default after feedback.",
    why: "Changing what thousands of existing users see on first load, without warning, is a product change in its own right.",
    verify: "The release notes state what the default is and how to change it.",
  },
  {
    id: "R8",
    priority: "Could",
    text: "Follow-ups for the readability motive beyond color: adjustable text size or density, and a higher-contrast variant.",
    why: "Several commenters describe vision needs that a color theme alone may not meet.",
    verify: "Defer until the audit in R2 shows what is still hard to read.",
  },
];

const TOC = [
  ["snapshot", "What the issue says"],
  ["evidence", "Evidence and verification status"],
  ["timeline", "Timeline"],
  ["signals", "Demand versus decision"],
  ["validate", "Step 0: validate before building"],
  ["problem", "Problem framing and hypotheses"],
  ["options", "Options"],
  ["requirements", "Proposed requirements"],
  ["mock", "Concept mocks"],
  ["lab", "What the triage board said, and what it cannot see"],
  ["metrics", "Success metrics, risks, open questions"],
] as const;

const OPTIONS: Array<{ id: string; title: string; verdict: string; tone: Tone; body: string }> = [
  {
    id: "A",
    title: "Light theme only",
    verdict: "Partial",
    tone: "warn",
    body: "Meets the explicit ask. It leaves the visible System option broken, and the larger problem of a missing decision untouched.",
  },
  {
    id: "B",
    title: "Light, Dark, and System (follow the device)",
    verdict: "Recommended target",
    tone: "ok",
    body: "Matches what the existing control already shows, and respects accessibility settings people have already made on their devices. The extra cost over A is modest if the theme is built on shared design tokens (an assumption to check).",
  },
  {
    id: "C",
    title: "Fix dark-theme contrast first",
    verdict: "Do first if the audit fails",
    tone: "accent",
    body: "If H1 is confirmed, this is an accessibility defect that stands on its own. It is smaller than a new theme, helps every user of the dark theme, and gives a quick, honest win while the larger work proceeds.",
  },
  {
    id: "D",
    title: "Decline publicly, with reasons",
    verdict: "Legitimate, but costly here",
    tone: "neutral",
    body: "A clear “no” is a valid product decision if the cost is too high. With 29 reactions, an accessibility angle, and a pull request in active review, it would need a strong reason, and the disabled options would have to go.",
  },
  {
    id: "E",
    title: "Adopt pull request #658 as the base, or rewrite",
    verdict: "Depends on Step 0",
    tone: "neutral",
    body: "An active review (19 inline comments) is a sign it is moving. At 176 files the review burden is real, so the decision turns on what reviewers say is still missing, not on a preference for either path.",
  },
];

export default async function DashboardCaseStudyPage() {
  const result = await getIssue("netbirdio/dashboard", 412);
  const issue = result?.issue;
  const suggestion = issue ? suggestScores(issue, categorize(issue), Date.now()) : null;

  return (
    <article className="mx-auto max-w-4xl space-y-12">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Case study 2 of 2 ·{" "}
          <Link href="/case-study" className="underline underline-offset-2">
            all case studies
          </Link>
        </p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
          A light theme request open for two years: when demand is clear and the decision is not
        </h1>
        <p className="max-w-3xl text-lg text-muted">
          A worked example of turning a long-running feature request (
          <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer" className="font-mono text-base text-accent underline underline-offset-2">
            netbirdio/dashboard#412<span className="sr-only"> (opens in a new tab)</span>
          </a>
          ) into a decision, requirements, and a UX concept. Where the first case study was about a bug whose existence was in doubt,
          this one is about a need nobody doubts and a decision nobody can see.
        </p>
        <CaseNote>
          <strong className="text-ink">Read this first.</strong> This is an independent portfolio exercise, not affiliated with
          NetBird and not a statement about its roadmap or its people. It uses the public issue, its 22 comments, and the public
          metadata of three linked pull requests, all read on {CAPTURED}. NetBird&rsquo;s source code and its dashboard&rsquo;s actual
          colors were <strong className="text-ink">not</strong> reviewed or measured. The visible thread is not the whole story:
          decisions can happen elsewhere, and silence in a thread is not proof of inaction. Commenters&rsquo; usernames are not shown.
        </CaseNote>
        <OnThisPage items={TOC} />
      </header>

      <Section id="snapshot" title="What the issue says">
        <div className="grid gap-4 md:grid-cols-2">
          <IssueMetadata result={result} capturedOn={CAPTURED} />
          <Card title="The user’s need">
            <p className="text-sm text-ink">
              The reporter, who describes themselves as an older developer, finds the dashboard&rsquo;s dark theme (gray on black)
              hard to read. They ask for a light theme and point out that the documentation site&rsquo;s light theme is readable.
            </p>
            <p className="mt-2 text-sm text-muted">
              They also notice a theme control in the top right where Light and System are shown but disabled, and wonder whether the
              feature is in the works.
            </p>
          </Card>
        </div>
      </Section>

      <Section
        id="evidence"
        title="Evidence and verification status"
        intro="Each claim says who made it and whether anyone has verified it. Most of the “verified” items here are GitHub's own public counts and metadata, which are facts; the explanations for them are not."
      >
        <EvidenceList items={EVIDENCE} />
        {issue && (
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <p className="mb-2 text-sm text-muted">
              The triage board&rsquo;s discussion panel can load the real thread, with commenter names left out, so that you can check
              the claims above yourself.
            </p>
            <DiscussionPanel issue={issue} />
          </div>
        )}
      </Section>

      <Section
        id="timeline"
        title="Timeline"
        intro="Items marked “Verified” come from GitHub's data. The one marked “Stated in a comment” is what a commenter said, which was not checked here."
      >
        <ol className="space-y-0 border-l-2 border-line pl-5">
          {TIMELINE.map((e) => (
            <li key={e.iso + e.text} className="relative pb-5 last:pb-0">
              <span aria-hidden="true" className="absolute -left-[1.62rem] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
              <div className="flex flex-wrap items-center gap-2">
                <time dateTime={e.iso} className="text-sm font-semibold text-ink">
                  {e.date}
                </time>
                <Pill tone={e.verified ? "ok" : "accent"}>{e.verified ? "Verified" : "Stated in a comment"}</Pill>
              </div>
              <p className="mt-1 text-sm text-muted">{e.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="signals"
        title="Demand versus decision"
        intro="The interesting thing about this issue is not how many people want a light theme. It is how little of that demand turned into a visible decision."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <BulletCard
            title="Demand: loud and consistent"
            items={[
              "29 thumbs-up reactions and 22 comments over about 25 months.",
              "By this analysis's count, 10 of the 22 comments are short upvotes or requests for news, 3 add a personal reason, and 7 carry information (pointers and status).",
              "Two separate community pull requests and a third-party image, built without being asked.",
              "Independent reasons that go beyond taste: older eyes, astigmatism, glare.",
            ]}
          />
          <BulletCard
            title="Decision: hard to see from outside"
            items={[
              "No owner, member, or collaborator comment in the thread, though accounts marked “contributor” did post status updates.",
              "Direct questions to the maintainers in April 2025 and August 2026 with no visible reply.",
              "The first community pull request closed after 16 months with no inline review comments.",
              "The label is still needs-triage after 25 months.",
              "By contrast, the client’s light mode, opened by a project collaborator, merged in 14 days after 22 inline review comments.",
            ]}
          />
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 text-sm">
          <p className="font-semibold text-ink">What this analysis concludes, and how sure it is</p>
          <p className="mt-1 text-ink">
            <strong>Hypothesis, not fact:</strong> the bottleneck was not demand but prioritization, ownership, and review capacity.
            Demand was visible within weeks; the first sign of a team-led change came after more than two years.
          </p>
          <p className="mt-2 text-muted">
            Other explanations fit the same facts: the team may have wanted the client first for consistency, a design system may
            have needed work before a theme was practical, the 110-file first pull request may have been too large to review, or the
            decisions may have been made in places this analysis cannot see. That is why Step 0 asks before it builds.
          </p>
        </div>
      </Section>

      <Section
        id="validate"
        title="Step 0: validate before building"
        intro="The newest facts change the right first move. A pull request is already in active review, so the product questions are about evidence, quality, and communication, not about whether to start."
      >
        <StepList
          steps={[
            [
              "Measure the current dark theme.",
              "Run an automated contrast audit on the key screens and review the failures by hand. If normal text falls below 4.5:1, that is an accessibility defect in its own right and can be fixed without waiting for a new theme.",
            ],
            [
              "Find out what stands between #658 and a merge.",
              "Read its review discussion and ask the reviewers: design sign-off, tests, visual regressions, or sheer size (176 files)? Also ask why #461 was closed, so the next contributor learns from it.",
            ],
            [
              "Publish a decision on the issue.",
              "Scope, owner, target release, and what happens to the open pull requests. Replace needs-triage. Even “not in the next release, because …” beats silence.",
            ],
            [
              "Stop the control from over-promising.",
              "If the release is not imminent, hide the disabled Light and System options or label them “not available yet”.",
            ],
          ]}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-danger-soft p-4 text-sm">
            <p className="font-semibold text-danger">If the audit finds failures</p>
            <p className="mt-1 text-ink">Ship the contrast fix first (R2) as a small, separate change. It helps every current user.</p>
          </div>
          <div className="rounded-xl border border-line bg-ok-soft p-4 text-sm">
            <p className="font-semibold text-ok">If #658 is close to merging</p>
            <p className="mt-1 text-ink">Spend the effort on verification and communication (R2, R3, R5), not on a rewrite.</p>
          </div>
          <div className="rounded-xl border border-line bg-warn-soft p-4 text-sm">
            <p className="font-semibold text-warn">If it is not close</p>
            <p className="mt-1 text-ink">Choose between the options below, and say which one in the issue.</p>
          </div>
        </div>
      </Section>

      <Section
        id="problem"
        title="Problem framing and hypotheses"
        intro="Three separable problems are tangled together in one thread. Separating them lets the team fix the cheapest real one first."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Preference", "Some people simply see better and work more comfortably on light backgrounds, and want to choose."],
            ["Readability", "The dark theme may be below accepted contrast levels. That would be a defect, not a preference."],
            ["Process", "Who decides, by when, and where can the people who asked see the answer?"],
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

      <Section id="options" title="Options" intro="Effort is unknown and needs engineering input. The size of the open pull request (176 files) only shows that a theme touches much of the interface.">
        <ul className="space-y-3">
          {OPTIONS.map((o) => (
            <li key={o.id} className="rounded-xl border border-line bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-semibold">{o.id}</span>
                <span className="font-semibold text-ink">{o.title}</span>
                <Pill tone={o.tone}>{o.verdict}</Pill>
              </div>
              <p className="mt-2 text-muted">{o.body}</p>
            </li>
          ))}
        </ul>
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink">
          <strong>Recommendation:</strong> run Step 0 now. If the audit fails, ship C immediately. Target B, using #658 as the base if
          its reviewers say it is sound. Whatever the outcome, do R5 this week: it costs one comment and removes the main source of
          repeated noise.
        </p>
      </Section>

      <Section
        id="requirements"
        title="Proposed requirements"
        intro="Written as user-visible outcomes, not implementation. Priorities use MoSCoW and assume the work goes ahead."
      >
        <RequirementList items={REQUIREMENTS} />
        <BulletCard
          title="Non-goals"
          items={[
            "Custom brand themes or per-user color pickers.",
            "Redesigning layouts or navigation as part of a theme change.",
            "Shipping anything from this prototype into NetBird. It is a portfolio concept only.",
          ]}
        />
      </Section>

      <Section id="mock" title="Concept mocks" intro="Two small interactive pieces. Both are concepts: neither is NetBird's interface.">
        <h3 className="text-lg font-semibold text-ink">The theme control, three versions</h3>
        <ThemeControlMock />
        <h3 className="pt-4 text-lg font-semibold text-ink">Turning “hard to read” into a number</h3>
        <p className="max-w-3xl text-sm text-muted">
          R2 needs an acceptance criterion that two people cannot argue about. Contrast ratio is one. Move the sliders to see where gray
          text on a near-black background stops being enough.
        </p>
        <ContrastExplorer />
      </Section>

      <Section
        id="lab"
        title="What the triage board said, and what it cannot see"
        intro="The triage board scored this issue from its title, description, comment count, and recency. Comparing that with the evidence above shows where an automatic score is useful and where it is blind."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="The board’s suggested draft scores">
            {suggestion ? (
              <>
                <dl className="grid grid-cols-3 gap-3 text-center">
                  {(["impact", "urgency", "effort"] as const).map((k) => (
                    <div key={k} className="rounded-lg bg-surface-2 p-2">
                      <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
                      <dd className="text-2xl font-semibold text-ink">{suggestion.scores[k]}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
                  {[...suggestion.rationale.impact, ...suggestion.rationale.urgency].map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">Suggestions are planning inputs, not facts. Effort is never inferred.</p>
              </>
            ) : (
              <p className="text-sm text-muted">The issue could not be loaded, so no scores were generated.</p>
            )}
          </Card>
          <BulletCard
            title="What the score cannot see"
            items={[
              "The 29 reactions. It counts comments, not reactions.",
              "That two pull requests exist, and what state they are in.",
              "That no team member has replied, unless someone loads the discussion.",
              "That the request has an accessibility angle, which may make it a defect rather than a preference.",
              "That the decision, not the demand, is what is overdue.",
            ]}
          />
        </div>
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink">
          <strong>Judgment:</strong> the board&rsquo;s medium priority understates it. What deserves urgency is not the build, which
          is already in review, but the missing decision (R5) and the possible readability defect (R2). No number is put on
          effort here: the remaining work is review and verification, and only the people doing it can estimate that.{" "}
          <Link href="/?issue=dashboard-412" className="font-medium text-accent underline underline-offset-2">
            Open this issue on the triage board
          </Link>{" "}
          to adjust its scores and draft its ticket.
        </p>
      </Section>

      <Section id="metrics" title="Success metrics, risks, open questions">
        <div className="grid gap-4 md:grid-cols-3">
          <BulletCard
            title="Proposed metrics"
            note="No baselines exist yet; each needs one before it can be a target."
            items={[
              "Time from a request to a visible decision (here: not yet, after 25 months).",
              "Contrast failures on the key screens, in each theme (target: none).",
              "Share of people who choose Light or System, if usage data exists.",
              "New upvote and “any news?” comments after the decision is posted.",
            ]}
          />
          <BulletCard
            title="Risks and trade-offs"
            items={[
              "Visual regressions across a very large surface.",
              "Two themes to test and maintain from now on.",
              "Embedded components that ignore the theme.",
              "Reviewing a very large change well, versus shipping it fast.",
              "Contributor goodwill: closing a large pull request without explanation discourages the next one.",
            ]}
          />
          <BulletCard
            title="Open questions"
            items={[
              "Does the dark theme meet AA contrast today?",
              "Why was #461 closed, and what blocks #658?",
              "Does the project have usage data to size demand?",
              "Should System become the default eventually?",
              "Do the client and the dashboard share design tokens?",
            ]}
          />
        </div>
      </Section>

      <p className="border-t border-line pt-6 text-sm text-muted">
        See also:{" "}
        <Link href="/case-study/5513" className="font-medium text-accent underline underline-offset-2">
          Case study 1: silent SSO session expiry
        </Link>
        , a bug report whose evidence is thin and whose first step is to find out whether it still happens.
      </p>
    </article>
  );
}
