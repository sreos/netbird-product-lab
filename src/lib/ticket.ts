import { CATEGORY_LABELS, type Categorization, type Category } from "./categorize";
import { BAND_LABELS, priorityBand, priorityScore, type Scores } from "./scoring";
import { formatDate, summarizeBody } from "./text";
import type { Issue } from "./types";

/**
 * Deterministic ticket drafting: the same inputs always produce the same text, with no AI involved.
 * The output is a starting point for a human to edit. It never asserts that a problem is reproduced.
 */

export interface QaScenario {
  title: string;
  steps: string[];
  expected: string;
}

export interface TicketDraft {
  title: string;
  problemStatement: string;
  userStory: string;
  acceptanceCriteria: string[];
  qaScenarios: QaScenario[];
  assumptions: string[];
}

type Key = Category | "general";

const TITLE_PREFIX: Record<Key, string> = {
  bug: "Fix:",
  reliability: "Harden:",
  ux: "Improve UX:",
  documentation: "Docs:",
  "feature-request": "Feature:",
  general: "Triage:",
};

function userStory(key: Key, title: string): string {
  const quoted = `"${title}"`;
  switch (key) {
    case "bug":
      return `As a user affected by ${quoted}, I want the described behavior to be corrected, so that I no longer need a manual workaround.`;
    case "reliability":
      return `As an operator running NetBird on long-lived machines, I want the failure described in ${quoted} to be detected and recovered from (or clearly surfaced), so that connectivity does not silently degrade.`;
    case "ux":
      return `As a person using the NetBird interface, I want the experience described in ${quoted} to be clear and predictable, so that I can finish my task without confusion.`;
    case "documentation":
      return `As someone setting up or operating NetBird, I want accurate documentation for the scenario in ${quoted}, so that I can configure it correctly the first time.`;
    case "feature-request":
      return `As a user who needs the capability requested in ${quoted}, I want it to be supported, so that I can reach my goal without custom workarounds.`;
    default:
      return `As a NetBird user, I want the concern raised in ${quoted} to be understood and addressed, so that I can rely on the product. (Persona is a placeholder; refine after triage.)`;
  }
}

const ACCEPTANCE: Record<Key, string[]> = {
  bug: [
    "Given the reproduction steps from the report, when they are followed on the latest supported release, then the expected behavior described in the report occurs.",
    "Given the fix is applied, when the original reproduction is retried, then no error, crash, or incorrect state is observed.",
    "Given related flows next to the fix, when regression checks run, then their behavior is unchanged.",
    "The fix is covered by an automated regression test where practical.",
  ],
  reliability: [
    "Given the failure condition from the report occurs, when the system is affected, then the problem is detected within a defined time bound (to be agreed) instead of failing silently.",
    "Given a detected failure, when automatic recovery is possible, then the system recovers without manual intervention; otherwise it surfaces an actionable status.",
    "Given the system is degraded, when a user or script checks status, then the status reflects the real state rather than reporting healthy.",
    "Diagnostics (logs or metrics) record when the failure was detected and how it was resolved, without leaking secrets.",
  ],
  ux: [
    "Given the screen or state described in the report, when a user reaches it, then the interface communicates what is happening and what to do next.",
    "Given keyboard-only or screen-reader use, when the flow is completed, then every step is operable and announced meaningfully.",
    "Given narrow and wide viewports, when the screen is rendered, then the layout remains usable.",
    "User-facing copy is reviewed for clarity and consistency with the rest of the product.",
  ],
  documentation: [
    "The documentation states prerequisites, steps, and expected results for the scenario in the report.",
    "Someone other than the author follows the steps on a clean environment and reaches the expected result.",
    "The page is linked from the places users look first (related docs, UI hints, or CLI help).",
    "Outdated or contradictory guidance is corrected or removed.",
  ],
  "feature-request": [
    "Requirements and non-goals are written down and agreed with the requester or stakeholders.",
    "Given the new capability is available, when a user follows the documented flow, then they can achieve the goal in the request.",
    "Existing behavior and configurations remain backward compatible, or the migration path is documented.",
    "Permissions, defaults, and security implications are reviewed, and the feature is documented.",
  ],
  general: [
    "The reported behavior is reproduced or explained on the latest supported release.",
    "A decision is recorded: fix, document, defer, or close, with the reason.",
    "If work is planned, follow-up tickets have their own acceptance criteria.",
  ],
};

const CATEGORY_SCENARIOS: Record<Key, QaScenario[]> = {
  bug: [
    {
      title: "Happy path after the fix",
      steps: ["Apply the fix.", "Run the user flow the report describes."],
      expected: "The flow completes with the behavior the reporter expected.",
    },
    {
      title: "Boundary and invalid input",
      steps: ["Repeat the flow with empty, very large, and unusual inputs where applicable."],
      expected: "The product handles them gracefully with a clear message, not a crash.",
    },
  ],
  reliability: [
    {
      title: "Induce the failure and observe detection",
      steps: ["Create the failure condition from the report (for example expire a session or cut the network).", "Wait for the agreed detection window."],
      expected: "The failure is detected and status changes accordingly; nothing keeps reporting healthy.",
    },
    {
      title: "Recovery without manual action",
      steps: ["Restore the failed dependency.", "Observe the system without intervening."],
      expected: "The system returns to a healthy state on its own, or shows exactly what action is required.",
    },
    {
      title: "Long-running soak",
      steps: ["Run the affected component unattended for an extended period with periodic fault injection."],
      expected: "No resource growth, hangs, or silent degradation.",
    },
  ],
  ux: [
    {
      title: "Keyboard and screen-reader pass",
      steps: ["Complete the flow using only the keyboard.", "Repeat with a screen reader."],
      expected: "Focus order is logical, controls are labelled, and state changes are announced.",
    },
    {
      title: "Responsive and theme check",
      steps: ["Render at mobile and desktop widths in light and dark themes."],
      expected: "No clipped content, overlap, or unreadable contrast.",
    },
  ],
  documentation: [
    {
      title: "Cold-start walkthrough",
      steps: ["On a clean environment, follow the documentation exactly as written."],
      expected: "The documented outcome is reached with no undocumented steps.",
    },
    {
      title: "Link and snippet validation",
      steps: ["Open every link and run every command snippet on the page."],
      expected: "All links resolve and all snippets run as shown.",
    },
  ],
  "feature-request": [
    {
      title: "Primary flow for the requested capability",
      steps: ["Enable or configure the capability.", "Perform the main task from the request."],
      expected: "The task succeeds and the result matches the agreed requirements.",
    },
    {
      title: "Backward compatibility",
      steps: ["Upgrade an existing setup that does not use the capability."],
      expected: "Existing behavior and configuration are unchanged.",
    },
  ],
  general: [
    {
      title: "Decision follow-up",
      steps: ["Confirm the chosen outcome (fix, document, defer, close) with the requester."],
      expected: "The reporter understands the outcome and the next step.",
    },
  ],
};

export function draftTicket(issue: Issue, categorization: Categorization, scores: Scores): TicketDraft {
  const key: Key = categorization.primary ?? "general";
  const score = priorityScore(scores);
  const band = BAND_LABELS[priorityBand(score)];
  const summary = summarizeBody(issue.body) || "(The reporter did not provide a description.)";
  const labels = issue.labels.length > 0 ? issue.labels.join(", ") : "none";
  const baseTitle = key === "feature-request" ? issue.title.replace(/^feature:\s*/i, "") : issue.title;

  const problemStatement = [
    `Reported in ${issue.repo}#${issue.number} on ${formatDate(issue.createdAt)}: "${issue.title}".`,
    `Reporter's description (excerpt, unverified): ${summary}`,
    `Draft estimate, not verified: impact ${scores.impact}/5, urgency ${scores.urgency}/5, effort ${scores.effort}/5, giving a priority score of ${score} (${band}).`,
    `GitHub labels: ${labels}. Category: ${CATEGORY_LABELS[key as Category] ?? "Uncategorized"}.`,
  ].join("\n");

  return {
    title: `${TITLE_PREFIX[key]} ${baseTitle}`,
    problemStatement,
    userStory: userStory(key, issue.title),
    acceptanceCriteria: ACCEPTANCE[key],
    qaScenarios: [
      {
        title: "Confirm the report still reproduces",
        steps: [
          "Identify the affected component and the version in the report.",
          "Retest on the latest supported release, using the reporter's reproduction steps.",
        ],
        expected: "Either the behavior is reproduced (proceed) or it is not (ask the reporter to confirm, then close or re-scope).",
      },
      ...CATEGORY_SCENARIOS[key],
    ],
    assumptions: [
      "The problem has not been reproduced by this tool; it is taken from a single public report.",
      "The reporter's version and environment may be outdated; confirm against the latest release first.",
      `Impact and urgency are suggested defaults or manual edits, not measurements. Effort (${scores.effort}/5) needs an engineering estimate.`,
      "The persona in the user story is a template default; adjust it to the real affected audience.",
    ],
  };
}

export function ticketToMarkdown(draft: TicketDraft, issue: Issue): string {
  const lines: string[] = [
    `# ${draft.title}`,
    "",
    `> Draft from a deterministic template. Unverified. Source: ${issue.url}`,
    "",
    "## Problem statement",
    "",
    draft.problemStatement,
    "",
    "## User story",
    "",
    draft.userStory,
    "",
    "## Acceptance criteria",
    "",
    ...draft.acceptanceCriteria.map((c) => `- [ ] ${c}`),
    "",
    "## QA test scenarios",
    "",
  ];
  draft.qaScenarios.forEach((s, i) => {
    lines.push(`### ${i + 1}. ${s.title}`, "", ...s.steps.map((step, n) => `${n + 1}. ${step}`), "", `**Expected:** ${s.expected}`, "");
  });
  lines.push("## Assumptions and open questions", "", ...draft.assumptions.map((a) => `- ${a}`), "");
  return lines.join("\n");
}
