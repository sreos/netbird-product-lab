import { describe, expect, it } from "vitest";
import { getSampleIssues } from "@/data/sample";
import {
  monthRange,
  niceTicks,
  SERIES_ORDER,
  sliceRows,
  summarize,
  toTrendRow,
  type TrendRow,
} from "./trends";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const row = (over: Partial<TrendRow> = {}): TrendRow => ({
  id: "netbirdio/netbird#1",
  repo: "netbirdio/netbird",
  createdAt: "2026-10-01T00:00:00Z",
  series: "bug",
  comments: 0,
  needsTriage: false,
  ...over,
});

describe("monthRange", () => {
  it("returns the last N calendar months, oldest first, ending with the current month", () => {
    const r = monthRange(NOW, 3);
    expect(r.map((m) => m.key)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(r.map((m) => m.label)).toEqual(["Aug 2026", "Sep 2026", "Oct 2026"]);
  });

  it("crosses year boundaries", () => {
    const r = monthRange(Date.parse("2026-02-15T00:00:00Z"), 4);
    expect(r.map((m) => m.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(r[0].year).toBe(2025);
  });

  it("starts every bucket with zero counts", () => {
    for (const m of monthRange(NOW, 2)) {
      expect(m.total).toBe(0);
      expect(Object.keys(m.counts).sort()).toEqual([...SERIES_ORDER].sort());
    }
  });
});

describe("sliceRows", () => {
  it("counts issues in the month they were created, per series, including months with none", () => {
    const rows = [
      row({ createdAt: "2026-10-03T00:00:00Z", series: "bug" }),
      row({ createdAt: "2026-10-20T00:00:00Z", series: "bug" }),
      row({ createdAt: "2026-08-31T23:59:59Z", series: "ux" }),
    ];
    const { buckets, inRange } = sliceRows(rows, NOW, 3, "all");
    expect(inRange).toHaveLength(3);
    expect(buckets[0]).toMatchObject({ key: "2026-08", total: 1 });
    expect(buckets[0].counts.ux).toBe(1);
    expect(buckets[1]).toMatchObject({ key: "2026-09", total: 0 });
    expect(buckets[2].counts.bug).toBe(2);
  });

  it("uses UTC, so an issue created just before midnight UTC stays in its month", () => {
    const { buckets } = sliceRows([row({ createdAt: "2026-09-30T23:59:59Z" })], NOW, 2, "all");
    expect(buckets[0]).toMatchObject({ key: "2026-09", total: 1 });
    expect(buckets[1].total).toBe(0);
  });

  it("reports how many matching issues are older than the window instead of silently dropping them", () => {
    const rows = [row({ createdAt: "2024-01-01T00:00:00Z" }), row({ createdAt: "2026-10-05T00:00:00Z" })];
    const slice = sliceRows(rows, NOW, 6, "all");
    expect(slice.inRange).toHaveLength(1);
    expect(slice.olderCount).toBe(1);
  });

  it("applies the repository filter to both the window and the older count", () => {
    const rows = [
      row({ repo: "netbirdio/netbird", createdAt: "2026-10-05T00:00:00Z" }),
      row({ repo: "netbirdio/dashboard", createdAt: "2026-10-06T00:00:00Z" }),
      row({ repo: "netbirdio/dashboard", createdAt: "2020-01-01T00:00:00Z" }),
    ];
    const slice = sliceRows(rows, NOW, 6, "netbirdio/dashboard");
    expect(slice.inRange).toHaveLength(1);
    expect(slice.olderCount).toBe(1);
  });

  it("ignores rows with an unreadable date", () => {
    const slice = sliceRows([row({ createdAt: "garbage" })], NOW, 3, "all");
    expect(slice.inRange).toHaveLength(0);
    expect(slice.olderCount).toBe(0);
  });
});

describe("summarize", () => {
  it("computes count, recent count, median age, and triage-labelled count", () => {
    const rows = [
      row({ createdAt: "2026-10-02T12:00:00Z", needsTriage: true }), // 10 days old
      row({ createdAt: "2026-08-13T12:00:00Z" }), // 60 days old
      row({ createdAt: "2026-01-14T12:00:00Z", needsTriage: true }), // 271 days old
    ];
    const s = summarize(rows, NOW);
    expect(s.count).toBe(3);
    expect(s.createdLast90Days).toBe(2);
    expect(s.medianAgeDays).toBe(60);
    expect(s.needsTriage).toBe(2);
  });

  it("breaks results down by series in the fixed order, with shares that add up", () => {
    const rows = [row({ series: "bug", comments: 4 }), row({ series: "bug", comments: 2 }), row({ series: "ux", comments: 1 })];
    const s = summarize(rows, NOW);
    expect(s.bySeries.map((x) => x.series)).toEqual([...SERIES_ORDER]);
    const bug = s.bySeries.find((x) => x.series === "bug")!;
    expect(bug).toMatchObject({ count: 2, avgComments: 3 });
    expect(bug.share).toBeCloseTo(2 / 3);
    expect(s.bySeries.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1);
    expect(s.bySeries.find((x) => x.series === "documentation")).toMatchObject({ count: 0, medianAgeDays: null, avgComments: null });
  });

  it("handles an empty slice without dividing by zero", () => {
    const s = summarize([], NOW);
    expect(s).toMatchObject({ count: 0, createdLast90Days: 0, medianAgeDays: null, needsTriage: 0 });
    expect(s.bySeries.every((x) => x.share === 0)).toBe(true);
  });

  it("never reports a negative age for an issue dated in the future", () => {
    expect(summarize([row({ createdAt: "2027-01-01T00:00:00Z" })], NOW).medianAgeDays).toBe(0);
  });
});

describe("toTrendRow", () => {
  it("uses the primary category, 'uncategorized' when there is none, and recognizes triage labels either repo uses", () => {
    const issues = getSampleIssues();
    const sso = toTrendRow(issues.find((i) => i.number === 5513)!);
    expect(sso.series).toBe("reliability");
    expect(sso.needsTriage).toBe(true); // "triage-needed"
    const dash = toTrendRow(issues.find((i) => i.repo === "netbirdio/dashboard" && i.labels.includes("needs-triage"))!);
    expect(dash.needsTriage).toBe(true);
    expect(issues.map(toTrendRow).every((r) => SERIES_ORDER.includes(r.series))).toBe(true);
  });
});

describe("niceTicks", () => {
  it("rounds the axis maximum up to a clean step (1, 2, or 5 times a power of ten)", () => {
    expect(niceTicks(7)).toEqual({ max: 8, ticks: [0, 2, 4, 6, 8] });
    expect(niceTicks(23)).toEqual({ max: 30, ticks: [0, 10, 20, 30] });
    expect(niceTicks(100)).toEqual({ max: 100, ticks: [0, 50, 100] });
    // 480 / 4 = 120 -> 1.2 x 100 -> step 2 x 100 = 200 -> max ceil(480 / 200) * 200 = 600
    expect(niceTicks(480)).toEqual({ max: 600, ticks: [0, 200, 400, 600] });
  });

  it("copes with zero and tiny maxima", () => {
    expect(niceTicks(0).ticks[0]).toBe(0);
    expect(niceTicks(0).max).toBeGreaterThan(0);
    expect(niceTicks(1).max).toBeGreaterThanOrEqual(1);
  });

  it("always covers the data", () => {
    for (const v of [1, 2, 3, 9, 17, 41, 99, 123, 480]) expect(niceTicks(v).max).toBeGreaterThanOrEqual(v);
  });
});
