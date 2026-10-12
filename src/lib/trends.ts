import { categorize, CATEGORIES, CATEGORY_LABELS, type Category } from "./categorize";
import type { Issue, RepoSlug } from "./types";

/**
 * Backlog trends computed from the LOADED issues only (the most recently updated open items per
 * repository). Because that selection is by activity rather than by creation date, older months are
 * under-represented, so these numbers describe the backlog as it is today, not a history of everything
 * that was ever reported. The page says so.
 */

export type SeriesKey = Category | "uncategorized";

/** Stack order, bottom to top. Colors are assigned by this fixed order and never by rank. */
export const SERIES_ORDER: readonly SeriesKey[] = [...CATEGORIES, "uncategorized"];

export const SERIES_LABELS: Record<SeriesKey, string> = { ...CATEGORY_LABELS, uncategorized: "Uncategorized" };

/** Labels GitHub projects use for "nobody has triaged this yet" (both repos use one of these). */
export const TRIAGE_LABELS = ["triage-needed", "needs-triage"] as const;

/** The compact per-issue record the trends view needs. */
export interface TrendRow {
  id: string;
  repo: RepoSlug;
  /** ISO 8601 */
  createdAt: string;
  /** Primary category, or "uncategorized". */
  series: SeriesKey;
  comments: number;
  needsTriage: boolean;
}

export function toTrendRow(issue: Issue): TrendRow {
  const labels = issue.labels.map((l) => l.toLowerCase());
  return {
    id: issue.id,
    repo: issue.repo,
    createdAt: issue.createdAt,
    series: categorize(issue).primary ?? "uncategorized",
    comments: issue.comments,
    needsTriage: TRIAGE_LABELS.some((t) => labels.includes(t)),
  };
}

export interface MonthBucket {
  /** "2026-03" */
  key: string;
  /** "Mar" */
  short: string;
  year: number;
  /** "Mar 2026" */
  label: string;
  counts: Record<SeriesKey, number>;
  total: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 24 * 60 * 60 * 1000;

const emptyCounts = (): Record<SeriesKey, number> => ({
  bug: 0,
  reliability: 0,
  ux: 0,
  documentation: 0,
  "feature-request": 0,
  uncategorized: 0,
});

const monthKey = (year: number, month0: number) => `${year}-${String(month0 + 1).padStart(2, "0")}`;

/** The last `months` calendar months (UTC) ending with the month that contains `nowMs`, oldest first. */
export function monthRange(nowMs: number, months: number): MonthBucket[] {
  const now = new Date(nowMs);
  const out: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const m = d.getUTCMonth();
    out.push({
      key: monthKey(year, m),
      short: MONTHS[m],
      year,
      label: `${MONTHS[m]} ${year}`,
      counts: emptyCounts(),
      total: 0,
    });
  }
  return out;
}

export interface Slice {
  /** Rows created inside the window (and matching the repository filter). */
  inRange: TrendRow[];
  /** Rows matching the repository filter but created before the window. */
  olderCount: number;
  buckets: MonthBucket[];
}

export function sliceRows(rows: TrendRow[], nowMs: number, months: number, repo: RepoSlug | "all"): Slice {
  const buckets = monthRange(nowMs, months);
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const inRange: TrendRow[] = [];
  let olderCount = 0;
  for (const row of rows) {
    if (repo !== "all" && row.repo !== repo) continue;
    const t = Date.parse(row.createdAt);
    if (Number.isNaN(t)) continue;
    const d = new Date(t);
    const bucket = byKey.get(monthKey(d.getUTCFullYear(), d.getUTCMonth()));
    if (!bucket) {
      // Earlier than the window. (Created after "now" cannot happen in practice and is ignored.)
      if (t < Date.parse(`${buckets[0].key}-01T00:00:00Z`)) olderCount += 1;
      continue;
    }
    bucket.counts[row.series] += 1;
    bucket.total += 1;
    inRange.push(row);
  }
  return { inRange, olderCount, buckets };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const ageDays = (row: TrendRow, nowMs: number) => Math.max(0, (nowMs - Date.parse(row.createdAt)) / DAY_MS);

export interface SeriesSummary {
  series: SeriesKey;
  count: number;
  /** 0 to 1 */
  share: number;
  medianAgeDays: number | null;
  avgComments: number | null;
}

export interface TrendSummary {
  count: number;
  createdLast90Days: number;
  medianAgeDays: number | null;
  needsTriage: number;
  bySeries: SeriesSummary[];
}

export function summarize(rows: TrendRow[], nowMs: number): TrendSummary {
  const bySeries: SeriesSummary[] = SERIES_ORDER.map((series) => {
    const mine = rows.filter((r) => r.series === series);
    const m = median(mine.map((r) => ageDays(r, nowMs)));
    return {
      series,
      count: mine.length,
      share: rows.length ? mine.length / rows.length : 0,
      medianAgeDays: m === null ? null : Math.round(m),
      avgComments: mine.length ? Math.round((mine.reduce((a, r) => a + r.comments, 0) / mine.length) * 10) / 10 : null,
    };
  });
  const m = median(rows.map((r) => ageDays(r, nowMs)));
  return {
    count: rows.length,
    createdLast90Days: rows.filter((r) => ageDays(r, nowMs) <= 90).length,
    medianAgeDays: m === null ? null : Math.round(m),
    needsTriage: rows.filter((r) => r.needsTriage).length,
    bySeries,
  };
}

/** A y-axis maximum and tick values that are clean numbers (1, 2, 5 times a power of ten). */
export function niceTicks(maxValue: number, targetTicks = 4): { max: number; ticks: number[] } {
  if (!(maxValue > 0)) return { max: targetTicks, ticks: Array.from({ length: targetTicks + 1 }, (_, i) => i) };
  const rough = maxValue / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v));
  return { max, ticks };
}
