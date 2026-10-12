"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  niceTicks,
  SERIES_LABELS,
  SERIES_ORDER,
  sliceRows,
  summarize,
  type MonthBucket,
  type SeriesKey,
  type TrendRow,
} from "@/lib/trends";
import { REPOS, type RepoSlug } from "@/lib/types";

/** Colors come from CSS variables (globals.css) so light and dark are validated, selected steps. */
const SERIES_COLOR: Record<SeriesKey, string> = {
  bug: "var(--series-1)",
  reliability: "var(--series-2)",
  ux: "var(--series-3)",
  documentation: "var(--series-4)",
  "feature-request": "var(--series-5)",
  uncategorized: "var(--series-other)",
};

const RANGES = [
  { months: 6, label: "Last 6 months" },
  { months: 12, label: "Last 12 months" },
  { months: 24, label: "Last 24 months" },
] as const;

// Chart geometry (pixels). Mark specs: bars at most 24px wide, 2px surface gap between segments,
// 4px rounded data-end on the top segment only, square at the baseline.
const HEIGHT = 300;
const MARGIN = { top: 26, right: 8, bottom: 42, left: 40 };
const MAX_BAR = 24;
const GAP = 2;
const RADIUS = 4;
const DEFAULT_WIDTH = 720;

const fmt = new Intl.NumberFormat("en-GB");

function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth(Math.max(300, w));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function describeBucket(b: MonthBucket, visible: readonly SeriesKey[], inProgress: boolean): string {
  const parts = visible.filter((s) => b.counts[s] > 0).map((s) => `${SERIES_LABELS[s]} ${b.counts[s]}`);
  const total = visible.reduce((a, s) => a + b.counts[s], 0);
  return `${b.label}: ${total} ${total === 1 ? "issue" : "issues"}${parts.length ? `. ${parts.join(", ")}` : ""}${
    inProgress ? ". This month is still in progress." : ""
  }`;
}

function Swatch({ series }: { series: SeriesKey }) {
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: SERIES_COLOR[series] }} />;
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold leading-tight text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

export function TrendsView({ rows, nowIso }: { rows: TrendRow[]; nowIso: string }) {
  const now = useMemo(() => Date.parse(nowIso), [nowIso]);
  const uid = useId();

  const [months, setMonths] = useState<number>(12);
  const [repo, setRepo] = useState<RepoSlug | "all">("all");
  const [hidden, setHidden] = useState<ReadonlySet<SeriesKey>>(new Set());
  const [view, setView] = useState<"chart" | "table">("chart");
  const [active, setActive] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const slice = useMemo(() => sliceRows(rows, now, months, repo), [rows, now, months, repo]);
  const summary = useMemo(() => summarize(slice.inRange, now), [slice, now]);
  const visible = useMemo(() => SERIES_ORDER.filter((s) => !hidden.has(s)), [hidden]);

  const plotRef = useRef<HTMLDivElement>(null);
  const width = useWidth(plotRef);
  const { buckets } = slice;
  const n = buckets.length;

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const slot = innerW / n;
  const barW = Math.min(MAX_BAR, slot * 0.62);
  const baseY = MARGIN.top + innerH;
  const visibleTotal = (b: MonthBucket) => visible.reduce((a, s) => a + b.counts[s], 0);
  const maxTotal = Math.max(0, ...buckets.map(visibleTotal));
  const { max: yMax, ticks } = niceTicks(maxTotal);
  const labelEvery = Math.max(1, Math.ceil(38 / slot));

  const toggleSeries = (s: SeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else if (SERIES_ORDER.length - next.size > 1) next.add(s); // always keep at least one series
      return next;
    });

  function indexFromPointer(clientX: number, el: HTMLElement): number | null {
    if (!Number.isFinite(clientX)) return null;
    const x = clientX - el.getBoundingClientRect().left - MARGIN.left;
    if (x < 0 || x > innerW) return null;
    return Math.min(n - 1, Math.max(0, Math.floor(x / slot)));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const move = (to: number) => {
      const i = Math.min(n - 1, Math.max(0, to));
      setActive(i);
      setAnnouncement(describeBucket(buckets[i], visible, i === n - 1));
    };
    const current = active ?? n - 1;
    if (e.key === "ArrowRight") move(current + 1);
    else if (e.key === "ArrowLeft") move(current - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(n - 1);
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  const activeBucket = active !== null ? buckets[active] : null;
  const activeX = active !== null ? MARGIN.left + slot * (active + 0.5) : 0;
  // Sit beside the hovered column, never on top of it or its neighbours' bars.
  const tooltipOnLeft = activeX > width / 2;
  const tooltipLeft = tooltipOnLeft ? activeX - slot / 2 - 8 : activeX + slot / 2 + 8;

  const chartSummary = `Stacked column chart of issues created per month, ${slice.inRange.length} issues over the last ${months} months, split by category.`;
  const empty = slice.inRange.length === 0;

  return (
    <div className="viz-root space-y-8">
      {/* One filter row above everything it scopes */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-xl border border-line bg-surface p-4">
        <fieldset>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Time range</legend>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => {
              const id = `${uid}-range-${r.months}`;
              return (
                <div key={r.months}>
                  <input
                    id={id}
                    type="radio"
                    name={`${uid}-range`}
                    checked={months === r.months}
                    onChange={() => {
                      setMonths(r.months);
                      setActive(null);
                    }}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={id}
                    className="block cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                  >
                    {r.label}
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>
        <div>
          <label htmlFor={`${uid}-repo`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Repository
          </label>
          <select
            id={`${uid}-repo`}
            value={repo}
            onChange={(e) => {
              setRepo(e.target.value as RepoSlug | "all");
              setActive(null);
            }}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="all">Both repositories</option>
            {REPOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-muted">
          Applies to everything below: the numbers, the chart, and the tables.
        </p>
      </div>

      {/* Figures */}
      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Issues in view" value={fmt.format(summary.count)} note="Created inside the time range" />
        <StatTile label="Created in the last 90 days" value={fmt.format(summary.createdLast90Days)} />
        <StatTile
          label="Median age"
          value={summary.medianAgeDays === null ? "n/a" : `${fmt.format(summary.medianAgeDays)} days`}
          note="Since the issue was created"
        />
        <StatTile
          label="Labelled as needing triage"
          value={`${fmt.format(summary.needsTriage)} of ${fmt.format(summary.count)}`}
          note={summary.count ? `${Math.round((summary.needsTriage / summary.count) * 100)}% still carry a triage label` : undefined}
        />
      </section>

      {/* Chart */}
      <section aria-labelledby={`${uid}-chart-h`} className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id={`${uid}-chart-h`} className="text-xl font-bold tracking-tight text-ink">
              Issues created per month
            </h2>
            <p className="text-sm text-muted">Each column is one calendar month (UTC), split by primary category.</p>
          </div>
          <button
            type="button"
            aria-pressed={view === "table"}
            onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-2"
          >
            {view === "chart" ? "View as table" : "View as chart"}
          </button>
        </div>

        {/* Legend: always present, doubles as a toggle to isolate series. Colors never change. */}
        <ul aria-label="Legend: choose a category to show or hide it" className="flex flex-wrap gap-2">
          {SERIES_ORDER.map((s) => {
            const shown = !hidden.has(s);
            const count = summary.bySeries.find((x) => x.series === s)?.count ?? 0;
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-pressed={shown}
                  onClick={() => toggleSeries(s)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ${
                    shown ? "border-line bg-surface text-ink hover:bg-surface-2" : "border-dashed border-line bg-surface-2 text-muted line-through"
                  }`}
                >
                  <Swatch series={s} />
                  <span>{SERIES_LABELS[s]}</span>
                  <span className="text-muted">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {empty ? (
          <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
            <p className="text-lg font-semibold text-ink">No issues were created in this range</p>
            <p className="mt-1 text-sm text-muted">Try a longer time range or the other repository.</p>
          </div>
        ) : (
          <>
            <div hidden={view === "table"} className="viz-chart-only rounded-xl border border-line bg-surface p-3 sm:p-4">
              <p id={`${uid}-hint`} className="mb-2 text-xs text-muted">
                Hover a column for details, or focus the chart and use the left and right arrow keys. The table view has the same numbers.
              </p>
              <div
                ref={plotRef}
                role="group"
                tabIndex={0}
                aria-label={chartSummary}
                aria-describedby={`${uid}-hint`}
                onKeyDown={onKeyDown}
                onFocus={() => {
                  // Start at the most recent month, or wherever the pointer already is, and say so.
                  const i = active ?? n - 1;
                  setActive(i);
                  setAnnouncement(describeBucket(buckets[i], visible, i === n - 1));
                }}
                onBlur={() => setActive(null)}
                onPointerMove={(e) => setActive(indexFromPointer(e.clientX, e.currentTarget))}
                onPointerLeave={() => setActive(null)}
                className="relative w-full rounded-lg"
              >
                <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true" className="block">
                  {/* Gridlines and y labels: solid hairlines, recessive */}
                  {ticks.map((t) => {
                    const y = baseY - (t / yMax) * innerH;
                    return (
                      <g key={t}>
                        <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
                        <text x={MARGIN.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
                          {fmt.format(t)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Hover band behind the active column */}
                  {active !== null && (
                    <rect x={MARGIN.left + slot * active} y={MARGIN.top - 12} width={slot} height={innerH + 12} fill="var(--surface-2)" />
                  )}

                  {buckets.map((b, i) => {
                    const cx = MARGIN.left + slot * (i + 0.5);
                    const x = cx - barW / 2;
                    const segs: Array<{ s: SeriesKey; y0: number; y1: number }> = [];
                    let cum = 0;
                    for (const s of visible) {
                      const c = b.counts[s];
                      if (!c) continue;
                      const h = (c / yMax) * innerH;
                      segs.push({ s, y0: cum, y1: cum + h });
                      cum += h;
                    }
                    const total = visibleTotal(b);
                    return (
                      <g key={b.key}>
                        {segs.map((seg, k) => {
                          const isTop = k === segs.length - 1;
                          const isBottom = k === 0;
                          const top = baseY - seg.y1 + (isTop ? 0 : GAP / 2);
                          const bottom = baseY - seg.y0 - (isBottom ? 0 : GAP / 2);
                          const h = bottom - top;
                          if (h <= 0.5) return null;
                          if (isTop) {
                            const r = Math.min(RADIUS, h / 2, barW / 2);
                            const d = `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${bottom} Z`;
                            return <path key={seg.s} d={d} fill={SERIES_COLOR[seg.s]} />;
                          }
                          return <rect key={seg.s} x={x} y={top} width={barW} height={h} fill={SERIES_COLOR[seg.s]} />;
                        })}
                        {total > 0 && (
                          <text x={cx} y={baseY - cum - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                            {total}
                          </text>
                        )}
                        {i % labelEvery === 0 && (
                          <text x={cx} y={baseY + 16} textAnchor="middle" fontSize={11} fill="var(--muted)">
                            {b.short}
                            {(i === 0 || b.short === "Jan") && (
                              <tspan x={cx} dy={13}>
                                {b.year}
                              </tspan>
                            )}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Baseline */}
                  <line x1={MARGIN.left} x2={width - MARGIN.right} y1={baseY} y2={baseY} stroke="var(--muted)" strokeOpacity={0.55} strokeWidth={1} />
                </svg>

                {/* One tooltip listing every visible series at the active month. Text via React, never innerHTML. */}
                {activeBucket && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute z-10 min-w-40 rounded-lg border border-line bg-surface p-3 text-sm shadow-lg"
                    style={{ left: tooltipLeft, top: MARGIN.top, transform: tooltipOnLeft ? "translateX(-100%)" : undefined }}
                  >
                    <p className="font-semibold text-ink">{activeBucket.label}</p>
                    {active === n - 1 && <p className="text-xs text-muted">Month in progress</p>}
                    <ul className="mt-1.5 space-y-1">
                      {visible.map((s) => (
                        <li key={s} className="flex items-center gap-2">
                          <span aria-hidden="true" className="inline-block h-0.5 w-3.5 shrink-0" style={{ backgroundColor: SERIES_COLOR[s] }} />
                          <span className="text-muted">{SERIES_LABELS[s]}</span>
                          <span className="ml-auto pl-3 font-semibold text-ink tabular-nums">{activeBucket.counts[s]}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 flex justify-between border-t border-line pt-1.5 text-muted">
                      <span>Total</span>
                      <span className="font-semibold text-ink tabular-nums">{visibleTotal(activeBucket)}</span>
                    </p>
                  </div>
                )}
              </div>
              <p role="status" aria-live="polite" className="sr-only">
                {announcement}
              </p>
            </div>

            <div
              hidden={view === "chart"}
              // Scrolls sideways on narrow screens, so keyboard users must be able to focus it.
              tabIndex={0}
              role="region"
              aria-label="Issues created per month by category, as a table"
              className="viz-table-twin overflow-x-auto rounded-xl border border-line bg-surface"
            >
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <caption className="sr-only">Issues created per month by category</caption>
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Month
                    </th>
                    {SERIES_ORDER.map((s) => (
                      <th key={s} scope="col" className="px-3 py-2 text-right font-semibold">
                        {SERIES_LABELS[s]}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((b, i) => (
                    <tr key={b.key} className="border-b border-line last:border-0">
                      <th scope="row" className="px-3 py-1.5 text-left font-medium text-ink">
                        {b.label}
                        {i === n - 1 && <span className="ml-1.5 font-normal text-muted">(so far)</span>}
                      </th>
                      {SERIES_ORDER.map((s) => (
                        <td key={s} className="px-3 py-1.5 text-right tabular-nums text-ink">
                          {b.counts[s]}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{b.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {slice.olderCount > 0 && (
          <p className="text-sm text-muted">
            {fmt.format(slice.olderCount)} more {slice.olderCount === 1 ? "issue was" : "issues were"} created before this range and{" "}
            {slice.olderCount === 1 ? "is" : "are"} not charted.
          </p>
        )}
      </section>

      {/* Category table */}
      <section aria-labelledby={`${uid}-cat-h`} className="space-y-3">
        <h2 id={`${uid}-cat-h`} className="text-xl font-bold tracking-tight text-ink">
          By category
        </h2>
        <div
          tabIndex={0}
          role="region"
          aria-label="Issues by primary category, as a table"
          className="overflow-x-auto rounded-xl border border-line bg-surface"
        >
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="sr-only">Issues in view, by primary category</caption>
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th scope="col" className="px-3 py-2 font-semibold">
                  Category
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Issues
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Share
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Median age (days)
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Avg. comments
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.bySeries.map((row) => (
                <tr key={row.series} className="border-b border-line last:border-0">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium text-ink">
                    <span className="flex items-center gap-2">
                      <Swatch series={row.series} />
                      {SERIES_LABELS[row.series]}
                    </span>
                  </th>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">{row.count}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">{Math.round(row.share * 100)}%</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">{row.medianAgeDays === null ? "n/a" : fmt.format(row.medianAgeDays)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">{row.avgComments === null ? "n/a" : row.avgComments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          Category is the issue&rsquo;s primary category from the triage board (a GitHub label where there is one, otherwise a guess from
          wording). Comment counts are an engagement signal, not a measure of impact.
        </p>
      </section>
    </div>
  );
}
