# NetBird Product Lab

**Turn open-source feedback into backlog-ready tickets.** A portfolio prototype that shows how a Technical Product Owner can triage public GitHub issues, prioritize them transparently, and draft actionable tickets.

> **Disclaimer.** This is an **independent portfolio prototype**. It is **not affiliated with, endorsed by, or sponsored by NetBird** or its maintainers. "NetBird" appears only to identify the public open-source repositories whose issues are analysed (`netbirdio/netbird`, `netbirdio/dashboard`). No NetBird logo or branding is used. Issue text belongs to its original authors. Categories, scores, hypotheses, and drafts here are this prototype's own inferences, may be wrong, and say nothing about NetBird's roadmap. Always read the source issue.

![Triage board with the issue list, categories, and the detail panel for issue #5513](docs/screenshots/01-triage-board.png)

## Contents

- [The problem](#the-problem)
- [Goals and non-goals](#goals-and-non-goals)
- [What it does](#what-it-does)
- [Screenshots](#screenshots)
- [How the model works](#how-the-model-works) (categorization and prioritization)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Deploying to Vercel](#deploying-to-vercel)
- [Tradeoffs](#tradeoffs)
- [Limitations](#limitations)
- [Roadmap](#roadmap)
- [Project structure](#project-structure)

## The problem

Open-source projects receive a steady stream of issues that mix bugs, reliability reports, UX friction, documentation gaps, and feature requests. Maintainers and product owners have to answer the same questions again and again: *What kind of problem is this? How much does it matter? Is it even still true? What would a ticket for it look like?*

Doing that by hand is slow, and doing it with opaque tooling is risky, because a confident-looking score or summary that is really a guess can steer real roadmap decisions. This project explores a middle path: **fast triage that is explicit about what is known, what is inferred, and what is unverified.**

## Goals and non-goals

**Goals**

- Read public issues from two repositories using GitHub's REST API, safely and cheaply (caching, fallback, rate-limit awareness).
- Categorize issues into bugs, reliability, UX, documentation, and feature requests, **showing the evidence** behind each label.
- Offer an **editable** impact / urgency / effort model where every default has a stated reason and is never presented as a fact.
- Draft a ticket (problem statement, user story, acceptance criteria, QA scenarios) from deterministic templates.
- Demonstrate product thinking on one real report: [case study of issue #5513](src/app/case-study/5513/page.tsx).
- Be accessible, responsive, tested, and deployable to Vercel with **no secrets required**.

**Non-goals**

- Writing to GitHub or to any NetBird system. Every external call is a `GET`.
- Replacing human judgment, or claiming a problem is reproduced or fixed.
- Being a full backlog manager (no accounts, no database, no sync).
- Being a statement about NetBird's product direction.

## What it does

| Area | What you get |
| --- | --- |
| **Data** | Open issues from `netbirdio/netbird` and `netbirdio/dashboard` via the GitHub REST API. Title, source link, labels, created date, comment count, and description. Pull requests are filtered out. |
| **Resilience** | Server-side fetch cached for 15 minutes. If GitHub is rate-limited, slow, or down, **each repository independently falls back** to a bundled snapshot of real issues, and a banner says which repo and why. |
| **Filtering** | Free-text search, repository filter, five category filters plus "Uncategorized", four sort orders, live counts, and a clear-filters action. |
| **Shareable views** | Filters, sort, and the selected issue live in the URL, so `/?cat=reliability&issue=netbird-5513` opens that exact view. "Copy link to this view" builds it for you. Edited scores are deliberately **not** in links (they stay in each person's browser); share a prioritized ticket by copying its Markdown. |
| **Categorization** | Label-based (solid badge) or wording-based (dashed badge, "inferred"). An issue can have several categories. The reasons are shown in the detail panel. |
| **Prioritization** | `priority = (impact × urgency) ÷ effort`, each 1 to 5. Defaults are labelled "Suggested (inferred, unverified)" with a "Why is the default N?" explanation. Edit with sliders; edits are marked "Edited by you", saved in your browser only, and resettable. |
| **Ticket drafting** | Problem statement, user story, acceptance criteria, QA test scenarios, and assumptions, from deterministic templates that update as you edit scores. Copy as Markdown. No AI involved. |
| **Case study** | A worked analysis of [`netbirdio/netbird#5513`](https://github.com/netbirdio/netbird/issues/5513): evidence ledger, validation-first plan, hypotheses, requirements (R1 to R8), and an interactive concept mock of connection-state UX. |
| **States** | Loading skeleton, error boundary, "no issues" and "no matches" empty states, sample-data banner, and not-found page. |

## Screenshots

Captured from a production build with live GitHub data on 12 Oct 2026.

| | |
| --- | --- |
| ![Priority sliders and the generated ticket draft](docs/screenshots/02-prioritize-and-ticket.png) **Prioritize and draft.** Every default is labelled as a suggestion and explained. | ![Dark theme](docs/screenshots/03-triage-board-dark.png) **Dark theme** follows the OS setting. |
| ![Case study page](docs/screenshots/04-case-study.png) **Case study** of issue #5513. | ![Concept mock of a "sign-in required" connection state](docs/screenshots/05-connection-state-mock.png) **Mock connection-state UX** (a concept, not a real client). |

<p align="center"><img src="docs/screenshots/06-mobile.png" alt="Mobile layout of the triage board" width="300"><br><em>Responsive layout at 390px wide.</em></p>

## How the model works

### Categorization ([`src/lib/categorize.ts`](src/lib/categorize.ts))

Two kinds of evidence, kept separate in the UI:

1. **GitHub labels** (a fact about the issue). Label vocabulary is taken from the two repositories, matched case-insensitively. For example `bug` maps to Bug, `connection` and `performance` to Reliability, `UX` and `client-ui` to UX, `documentation` and `missing-docs` to Documentation, `enhancement` and `feature-request` to Feature request.
2. **Wording** (an inference). Keyword patterns over the title (weight 2) and the first 1,500 characters of the description (weight 1). A category is only suggested when the combined weight reaches 2, so a single stray word does not trigger it.

Example: issue #5513 has only a `triage-needed` label, so its categories come purely from wording and are drawn with dashed badges. The detail panel lists exactly which words matched.

### Prioritization ([`src/lib/scoring.ts`](src/lib/scoring.ts))

`priority = (impact × urgency) ÷ effort`, rounded to one decimal. Bands: **≥ 8 higher**, **≥ 3 medium**, below that **lower**.

| Input | Starts at | Adjustments (each stated in the UI) |
| --- | --- | --- |
| **Impact** | 2 | +1 if categorized as bug or reliability; +1 for 5 or more comments; +1 more for 15 or more |
| **Urgency** | 2 | +1 for severe wording (security, crash, outage, silent failure, cannot log in); +1 for a bug/reliability report with 3 or more comments; +1 if updated in the last 30 days |
| **Effort** | 3, fixed | **Never inferred.** Effort needs an engineering estimate, and the UI says so. |

Comment counts are an *engagement proxy*, not measured user impact. The model is deliberately small enough to read in one sitting, so a reviewer can disagree with it.

### Ticket templates ([`src/lib/ticket.ts`](src/lib/ticket.ts))

Each category has its own user-story persona, acceptance criteria (Given/When/Then where it helps), and QA scenarios. Every draft starts with a "confirm the report still reproduces" scenario and ends with assumptions that state, in plain words, that the problem has not been reproduced by this tool.

## Architecture

```mermaid
flowchart LR
  GH[("GitHub REST API<br/>GET only")] -->|"fetch, cached 15 min"| SRV["Server code<br/>src/lib/github.ts"]
  SNAP[("Bundled sample snapshot<br/>src/data/sample-issues.json")] -.->|"per-repo fallback"| SRV
  SRV --> NORM["normalize + clean<br/>src/lib/normalize.ts"]
  NORM --> PAGES["Server components<br/>/ and /case-study/5513"]
  PAGES --> BOARD["Client: TriageBoard<br/>categorize, score, draft"]
  BOARD --> LS[("localStorage<br/>score edits only")]
```

- **Server-side data access.** GitHub is called only from server code (`src/lib/github.ts` imports `server-only`). The browser never talks to GitHub, so there is no CORS concern and the optional token can never leak.
- **Static with revalidation.** Both pages are statically generated and revalidated every 15 minutes (`revalidate = 900`). With two repositories plus the case study, that is roughly a dozen GitHub requests per hour regardless of how many people visit.
- **One normalizer for live and sample data.** The sample snapshot is stored in GitHub's own payload shape and runs through the same `normalizeIssue` path, so the fallback exercises the production code.
- **Untrusted text stays inert.** Issue bodies are plain text rendered by React (escaped). Only `**bold**` and `` `code` `` are formatted, built as React elements, never as HTML. Issue URLs are rebuilt from repository and number, never taken from the API payload.
- **Pure logic, thin UI.** Categorization, scoring, and ticket drafting are pure functions with unit tests. Components stay small.
- **Read-only by construction.** One function issues network requests, and it only sends `GET`. A test asserts this.

## Getting started

Requires **Node 20.9 or newer**.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. No configuration is needed.

### Environment variables

All optional. See [`.env.example`](.env.example) and copy it to `.env.local` if you want to set any.

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Server-side only. Raises GitHub's limit from 60 to 5,000 requests per hour. Use a fine-grained token with read-only access to public repositories and no extra permissions. Never prefixed with `NEXT_PUBLIC_`. |
| `USE_SAMPLE_DATA` | Set to `1` to skip GitHub and always use the bundled snapshot (offline development, demos, screenshots). |

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Watch mode |

### Tests

75 tests in 10 files cover:

- **GitHub client:** pull-request filtering, `GET`-only requests, optional bearer token, rate-limit / network / HTTP-error / invalid-payload fallback, per-repository fallback, sample mode.
- **Categorization:** label vs wording evidence, case-insensitive labels, the threshold against weak hints, and coverage of all five categories in the sample data.
- **Scoring:** the formula, band thresholds, "effort is never inferred", explained adjustments, and sanitizing tampered stored values.
- **Ticket templates:** determinism, required sections, every category, "never presented as verified".
- **UI flows:** filtering, empty states, editing, persisting and resetting scores, corrupted `localStorage`, selection, ticket sections, the connection-state mock, and hostile-HTML rendering.
- **URL state:** parsing and serializing views, safe fallbacks for unknown or hostile parameters, restoring a view on load, keeping the address bar in sync, the "linked issue is not loaded" notice, and that copied links carry no scores.

The build was also checked with the **axe-core** automated accessibility engine in light and dark themes (0 violations on the board, a selected issue, and the case study). That is an automated scan, not a substitute for manual screen-reader testing.

## Deploying to Vercel

1. Push this folder to a Git repository and import it in Vercel. The Next.js framework preset is detected automatically; no `vercel.json` is needed.
2. Deploy. **No environment variables are required.**
3. Optional but recommended: add `GITHUB_TOKEN` (see above) under *Project Settings → Environment Variables*. Unauthenticated requests are limited to 60 per hour **per IP**, and hosted build and server IPs may be shared with other projects, so a token makes live data more reliable. Without one, the app still works and falls back to the sample snapshot with a visible banner.

The production build succeeds with or without network access, because a failed fetch falls back to sample data instead of failing the build.

## Tradeoffs

| Decision | Why | What it costs |
| --- | --- | --- |
| **Server-side fetch with 15-minute revalidation** instead of fetching in the browser | Shares one cache across all visitors, protects the rate limit, keeps any token off the client | Data can be up to 15 minutes old |
| **Keyword and label heuristics** instead of an ML or LLM classifier | Transparent, free, deterministic, unit-testable, evidence can be shown | Lower recall, English only, will mislabel some issues |
| **One small scoring formula** instead of full RICE or weighted models | Readable in a minute and easy to challenge | Coarse 1 to 5 integers, not calibrated against outcomes |
| **Deterministic ticket templates** instead of AI drafting | Reproducible, no keys, no user data leaves the app | Generic text; a human adds the specifics |
| **`localStorage` for edits** instead of a database | No backend, no accounts, no secrets | Edits do not sync across devices or people |
| **Only view state in shareable URLs, not scores** | A link can never silently overwrite someone else's own edits, and nothing about a triage is stored server-side | A shared link shows the viewer's own (or suggested) scores; sharing a prioritized ticket means copying its Markdown |
| **Plain-text issue bodies** instead of rendering Markdown | Removes a whole class of injection risk from untrusted text | Loses most formatting |
| **First page only** (the 60 most recently updated open items per repository) | Small, fast, rate-limit friendly | Not the complete backlog |

## Limitations

- **Not a complete backlog.** Only the 60 most recently updated open items per repository are read, and pull requests are removed, so you typically see fewer than 120 issues (63 at the time of the screenshots).
- **Categories and scores are heuristics.** They can be wrong. They are labelled as suggestions in the interface for that reason.
- **Comments are not read.** Only the issue description and the comment *count* are used. The case study's summary of the discussion was written by hand from the public thread on 12 Oct 2026.
- **The case study is a snapshot.** The issue may change after that date. The page shows live metadata (state, dates, comments) when GitHub is reachable, but the analysis text does not update itself. At the time of writing, a maintainer had asked the reporter to retest on a newer release, so whether the problem still exists is **unknown**, and the case study is built around that.
- **The mock UX is a concept.** It is not NetBird's interface, and its CLI wording is invented.
- **The sample snapshot is old by design.** It was taken on 12 Oct 2026, with descriptions cut to 1,500 characters.
- **Shared-IP rate limiting.** See the Vercel notes above.
- **Accessibility** was checked with automated tooling and keyboard-oriented design, not with assistive-technology user testing.
- **No Content-Security-Policy header yet** (basic security headers are set in `next.config.ts`).

## Roadmap

**Near term**

- Editable ticket draft with a "regenerate from template" action.
- "Load more" pagination.
- ESLint and a Playwright end-to-end suite added to CI.
- Content-Security-Policy with nonces.

**Next**

- Duplicate and related-issue detection.
- Read and summarize issue comments, with the source comment linked for every claim.
- Configurable label vocabulary and scoring weights, with the configuration shown on screen.
- Trend view: new issues per category over time.
- Export a draft as a pre-filled "new issue" link for a repository the user owns (still no writes from this app).

**Optional AI assist** (only if it stays honest)

- A server-side route that refines the deterministic draft, behind an explicit opt-in, with the user's own key held server-side only, never in the browser.
- The deterministic template remains the baseline and the fallback.
- Every AI-written line is marked as AI-written, and nothing is auto-published.

## Project structure

```
src/
  app/
    page.tsx                  Triage board (server component, revalidated every 15 min)
    case-study/5513/page.tsx  Case study
    loading.tsx, error.tsx, not-found.tsx
  components/
    TriageBoard.tsx           Filters, sorting, selection, persisted score edits
    IssueCard.tsx, IssueDetail.tsx
    ScoringPanel.tsx, TicketPanel.tsx, TicketView.tsx
    ConnectionStateMock.tsx   Interactive concept mock for the case study
    PlainText.tsx             Safe rendering of untrusted text
  lib/
    github.ts                 Read-only GitHub client, caching, per-repo fallback (server-only)
    normalize.ts, text.ts     Payload mapping and sanitizing
    categorize.ts, scoring.ts, ticket.ts   Pure, tested logic
  data/
    sample-issues.json        Snapshot of real public issues (12 Oct 2026)
    sample.ts
docs/screenshots/
```

## Attribution and licence

This prototype's code is released under the [MIT License](LICENSE). The licence covers the code only: issue titles and descriptions belong to their original authors, are shown as read from the public GitHub API with a link to each source, and are not relicensed by this project. The name and brand "NetBird" belong to their owners.
