"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categorize, CATEGORIES, CATEGORY_LABELS, type Categorization } from "@/lib/categorize";
import {
  clampScore,
  priorityScore,
  resolveScores,
  suggestScores,
  type ScoreKey,
  type ScoreOverrides,
  type ScoreSuggestion,
} from "@/lib/scoring";
import { REPOS, type Issue, type RepoSlug } from "@/lib/types";
import { issueKey, parseView, serializeView, type CategoryFilter, type SortKey } from "@/lib/urlState";
import { IssueCard } from "./IssueCard";
import { IssueDetail } from "./IssueDetail";

const STORAGE_KEY = "nbpl:score-overrides:v1";

interface Row {
  issue: Issue;
  categorization: Categorization;
  suggestion: ScoreSuggestion;
  haystack: string;
}

const SORT_LABELS: Record<SortKey, string> = {
  priority: "Draft priority (high to low)",
  updated: "Recently updated",
  comments: "Most comments",
  created: "Newest created",
};

function loadOverrides(): Record<string, ScoreOverrides> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, ScoreOverrides> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const clean: ScoreOverrides = {};
      for (const key of ["impact", "urgency", "effort"] as const) {
        const n = (value as Record<string, unknown>)[key];
        if (typeof n === "number") clean[key] = clampScore(n);
      }
      if (Object.keys(clean).length > 0) out[id] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, ScoreOverrides>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Storage can be unavailable (private mode, blocked). The app works without persistence.
  }
}

export function TriageBoard({ issues, nowIso }: { issues: Issue[]; nowIso: string }) {
  const now = useMemo(() => Date.parse(nowIso), [nowIso]);
  const rows = useMemo<Row[]>(
    () =>
      issues.map((issue) => {
        const categorization = categorize(issue);
        return {
          issue,
          categorization,
          suggestion: suggestScores(issue, categorization, now),
          haystack: `${issue.number} ${issue.title} ${issue.labels.join(" ")} ${issue.body}`.toLowerCase(),
        };
      }),
    [issues, now],
  );

  const [query, setQuery] = useState("");
  const [repo, setRepo] = useState<RepoSlug | "all">("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sort, setSort] = useState<SortKey>("priority");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, ScoreOverrides>>({});
  const [hydrated, setHydrated] = useState(false);
  const [missingIssue, setMissingIssue] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const isNarrowScreen = () => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 1023px)").matches;

  // Saved edits and the shared view (URL) are read after mount so the server render and the
  // first client render match. The URL is untrusted input; parseView falls back to defaults.
  useEffect(() => {
    setOverrides(loadOverrides());
    const view = parseView(window.location.search);
    setQuery(view.query);
    setRepo(view.repo);
    setCategory(view.category);
    setSort(view.sort);
    if (view.issueId) {
      if (rows.some((r) => r.issue.id === view.issueId)) {
        setSelectedId(view.issueId);
        const id = view.issueId;
        // Bring the linked issue into view once the filtered list has rendered.
        window.setTimeout(() => {
          if (isNarrowScreen()) {
            panelRef.current?.scrollIntoView?.({ block: "start" });
            document.getElementById("detail-heading")?.focus({ preventScroll: true });
          } else {
            document.getElementById(`issue-${issueKey(id)}`)?.scrollIntoView?.({ block: "center" });
          }
        }, 60);
      } else {
        setMissingIssue(view.issueId);
      }
    }
    setHydrated(true);
    // Runs once on mount; `rows` comes from props and is stable for this page.
  }, []);
  useEffect(() => {
    if (hydrated) saveOverrides(overrides);
  }, [overrides, hydrated]);

  // Keep the address bar in sync so the current view can be shared. replaceState (not pushState)
  // avoids filling the back button with one entry per keystroke.
  useEffect(() => {
    if (!hydrated) return;
    const qs = serializeView({ query, repo, category, sort, issueId: selectedId });
    window.history.replaceState(null, "", `${window.location.pathname}${qs}${window.location.hash}`);
  }, [hydrated, query, repo, category, sort, selectedId]);

  const scoresFor = (row: Row) => resolveScores(row.suggestion.scores, overrides[row.issue.id]);

  const matchesSearch = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (repo === "all" || r.issue.repo === repo) && (!q || r.haystack.includes(q)));
  }, [rows, repo, query]);

  const counts = useMemo(() => {
    const c: Record<CategoryFilter, number> = {
      all: matchesSearch.length,
      uncategorized: matchesSearch.filter((r) => r.categorization.matches.length === 0).length,
      bug: 0,
      reliability: 0,
      ux: 0,
      documentation: 0,
      "feature-request": 0,
    };
    for (const r of matchesSearch) for (const m of r.categorization.matches) c[m.category] += 1;
    return c;
  }, [matchesSearch]);

  const visible = useMemo(() => {
    const filtered = matchesSearch.filter((r) => {
      if (category === "all") return true;
      if (category === "uncategorized") return r.categorization.matches.length === 0;
      return r.categorization.matches.some((m) => m.category === category);
    });
    const byDate = (a: string, b: string) => Date.parse(b) - Date.parse(a);
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "updated":
          return byDate(a.issue.updatedAt, b.issue.updatedAt);
        case "created":
          return byDate(a.issue.createdAt, b.issue.createdAt);
        case "comments":
          return b.issue.comments - a.issue.comments;
        default:
          return (
            priorityScore(resolveScores(b.suggestion.scores, overrides[b.issue.id])) -
              priorityScore(resolveScores(a.suggestion.scores, overrides[a.issue.id])) || b.issue.comments - a.issue.comments
          );
      }
    });
  }, [matchesSearch, category, sort, overrides]);

  const selected = visible.find((r) => r.issue.id === selectedId) ?? visible[0] ?? null;
  const filtersActive = query.trim() !== "" || repo !== "all" || category !== "all";

  function select(id: string) {
    setSelectedId(id);
    setMissingIssue(null);
    // On narrow screens the detail panel sits below the list, so bring it into view.
    if (isNarrowScreen()) {
      requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView?.({ block: "start" });
        document.getElementById("detail-heading")?.focus({ preventScroll: true });
      });
    }
  }

  function changeScore(row: Row, key: ScoreKey, value: number) {
    // Pin the selection first: with a priority sort, this edit re-orders the list, and an
    // implicit "first item" selection would otherwise jump to a different issue mid-edit.
    setSelectedId(row.issue.id);
    setOverrides((prev) => {
      const next = { ...prev };
      const current = { ...next[row.issue.id] };
      if (value === row.suggestion.scores[key]) delete current[key];
      else current[key] = clampScore(value);
      if (Object.keys(current).length === 0) delete next[row.issue.id];
      else next[row.issue.id] = current;
      return next;
    });
  }

  function resetScores(id: string) {
    setSelectedId(id);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setRepo("all");
    setCategory("all");
  }

  const pills: { id: CategoryFilter; label: string }[] = [
    { id: "all", label: "All" },
    ...CATEGORIES.map((c) => ({ id: c as CategoryFilter, label: CATEGORY_LABELS[c] })),
    { id: "uncategorized", label: "Uncategorized" },
  ];

  const fieldClass = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted";

  return (
    <section aria-labelledby="board-heading">
      <h2 id="board-heading" className="sr-only">
        Issue triage board
      </h2>

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div>
            <label htmlFor="q" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Search
            </label>
            <input
              id="q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, description, label, or number"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="repo" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Repository
            </label>
            <select id="repo" value={repo} onChange={(e) => setRepo(e.target.value as RepoSlug | "all")} className={fieldClass}>
              <option value="all">Both repositories</option>
              {REPOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Sort by
            </label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={fieldClass}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div role="group" aria-label="Filter by category" className="mt-4 flex flex-wrap gap-2">
          {pills.map((p) => {
            const active = category === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(p.id)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  active
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                {p.label} <span className={active ? "font-normal" : "text-muted"}>{counts[p.id]}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          Badge key: a <strong className="text-ink">solid</strong> category badge comes from a GitHub label; a{" "}
          <strong className="text-ink">dashed</strong> one is inferred from wording and may be wrong. One issue can have several
          categories.
        </p>
      </div>

      <p role="status" aria-live="polite" className="mt-4 text-sm text-muted">
        Showing {visible.length} of {rows.length} issues
        {filtersActive && (
          <>
            {" "}
            ·{" "}
            <button type="button" onClick={clearFilters} className="font-medium text-accent underline underline-offset-2">
              Clear filters
            </button>
          </>
        )}
      </p>

      {missingIssue && (
        <p role="status" className="mt-3 rounded-lg border border-warn/40 bg-warn-soft px-4 py-2.5 text-sm text-warn">
          <span aria-hidden="true">▲ </span>
          The linked issue{" "}
          <a
            href={`https://github.com/${missingIssue.replace("#", "/issues/")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono underline underline-offset-2"
          >
            {missingIssue}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{" "}
          is not in the loaded data. Only the 60 most recently updated open items per repository are loaded, so it may be older,
          closed, or not an issue.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No open issues found" body="The repositories returned no open issues, and no sample data is available." />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No issues match these filters"
          body="Try a different search term or category."
          action={
            <button type="button" onClick={clearFilters} className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          <div id="issue-list" className="scroll-mt-4">
            <ul className="space-y-3" aria-label="Issues">
              {visible.map((row) => (
                <li key={row.issue.id}>
                  <IssueCard
                    issue={row.issue}
                    categorization={row.categorization}
                    scores={scoresFor(row)}
                    edited={overrides[row.issue.id] !== undefined}
                    selected={selected?.issue.id === row.issue.id}
                    onSelect={() => select(row.issue.id)}
                  />
                </li>
              ))}
            </ul>
          </div>

          {selected && (
            <aside
              ref={panelRef}
              aria-label="Selected issue: triage and ticket draft"
              // The panel scrolls independently on desktop, so it must be keyboard-focusable.
              tabIndex={0}
              className="scroll-mt-4 rounded-xl border border-line bg-surface-2 p-4 sm:p-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
            >
              <IssueDetail
                key={selected.issue.id}
                issue={selected.issue}
                categorization={selected.categorization}
                suggestion={selected.suggestion}
                overrides={overrides[selected.issue.id]}
                scores={scoresFor(selected)}
                onScoreChange={(key, value) => changeScore(selected, key, value)}
                onScoreReset={() => resetScores(selected.issue.id)}
              />
            </aside>
          )}
        </div>
      )}
    </section>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
