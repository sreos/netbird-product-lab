import { describe, expect, it } from "vitest";
import { getSampleIssues } from "@/data/sample";
import { buildSimilarity, stem, tokenize } from "./similarity";
import type { Issue } from "./types";

const mk = (n: number, title: string, body = ""): Issue => ({
  id: `netbirdio/netbird#${n}`,
  repo: "netbirdio/netbird",
  number: n,
  title,
  url: `https://github.com/netbirdio/netbird/issues/${n}`,
  labels: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
  comments: 0,
  body,
  bodyTruncated: false,
});
const id = (n: number) => `netbirdio/netbird#${n}`;

// Two genuinely related reliability reports, a rare-title-word pair, and unrelated filler.
const CORPUS: Issue[] = [
  mk(1, "Client memory keeps growing while Management is unreachable", "The client retries forever and the memory leak grows when management is unreachable."),
  mk(2, "Signal stream never retries after outage while Management unreachable", "After a network outage the stream does not retry, management stays unreachable for the client."),
  mk(3, "High latency", "Pings are slow on my link."),
  mk(4, "Large latency spikes at night", "Latency jumps in the evening for remote peers."),
  mk(5, "Add dark theme contrast options", "The theme is hard to read, contrast is too low."),
  mk(6, "Windows installer msi fails on upgrade", "The msi installer aborts when upgrading an existing version."),
  mk(7, "Typo in the readme quickstart", "A word is misspelled in the quickstart section."),
  mk(8, "Export audit events to CSV", "Please allow exporting the audit log as a spreadsheet."),
  mk(9, "Rotate setup keys automatically", "Setup keys should expire and rotate on a schedule."),
  mk(10, "Mobile app crashes on launch", "The android application closes right after the splash screen."),
  mk(11, "Slow search on large peer lists", "Searching among thousands of peers is sluggish."),
  mk(12, "Cannot upload organization logo", "Uploading a png logo returns a validation error."),
];

describe("stem", () => {
  it("unifies common word forms", () => {
    expect(new Set(["reconnect", "reconnecting", "reconnected", "reconnects"].map(stem)).size).toBe(1);
    expect(new Set(["retry", "retries", "retried", "retrying"].map(stem)).size).toBe(1);
    expect(new Set(["expire", "expires", "expired", "expiring"].map(stem)).size).toBe(1);
  });

  it("leaves short words alone", () => {
    expect(stem("dns")).toBe("dns");
    expect(stem("ssh")).toBe("ssh");
  });
});

describe("tokenize", () => {
  it("drops code blocks, URLs, numbers, stopwords, and very short or very long tokens", () => {
    const tokens = tokenize("The client fails with ```\nlong stack trace here\n``` see https://example.com/x 12345 ok " + "a".repeat(40));
    expect(tokens).not.toContain("stack");
    expect(tokens).not.toContain("example");
    expect(tokens).not.toContain("12345");
    expect(tokens).not.toContain("the");
    expect(tokens.some((t) => t.length > 25)).toBe(false);
  });

  it("reports how each kept word originally looked", () => {
    const seen: Array<[string, string]> = [];
    tokenize("sessions expired", (s, surface) => seen.push([s, surface]));
    expect(seen).toEqual([
      ["sess", "sessions"],
      ["expir", "expired"],
    ]);
  });
});

describe("buildSimilarity", () => {
  const index = buildSimilarity(CORPUS);

  it("links two reports about the same failure and shows the words they share", () => {
    const related = index.related(id(1));
    expect(related.map((m) => m.id)).toContain(id(2));
    const match = related.find((m) => m.id === id(2))!;
    expect(match.shared.join(" ")).toMatch(/unreachable|management/);
    expect(match.score).toBeGreaterThan(0);
  });

  it("treats a rare word shared by both titles as strong evidence, even with short descriptions", () => {
    expect(index.related(id(3)).map((m) => m.id)).toContain(id(4));
  });

  it("does not link unrelated issues", () => {
    expect(index.related(id(1)).map((m) => m.id)).not.toContain(id(5));
    expect(index.related(id(6)).length).toBe(0);
    expect(index.related(id(7)).length).toBe(0);
  });

  it("honours the related threshold", () => {
    expect(index.related(id(1)).length).toBeGreaterThan(0);
    expect(buildSimilarity(CORPUS, { relatedThreshold: 0.99 }).related(id(1))).toEqual([]);
  });

  it("is symmetric and never relates an issue to itself", () => {
    for (const issue of CORPUS) {
      for (const m of index.related(issue.id)) {
        expect(m.id).not.toBe(issue.id);
        expect(index.related(m.id).map((x) => x.id)).toContain(issue.id);
      }
    }
  });

  it("returns matches strongest first and no more than the limit", () => {
    const many = buildSimilarity(CORPUS, { relatedThreshold: 0.01, themeThreshold: 0.01, maxRelated: 2 });
    for (const issue of CORPUS) {
      const r = many.related(issue.id);
      expect(r.length).toBeLessThanOrEqual(2);
      expect([...r].sort((a, b) => b.score - a.score)).toEqual(r);
    }
  });

  it("groups related issues into a labelled theme and exposes it per issue", () => {
    const theme = index.themeOf(id(1));
    expect(theme).toBeDefined();
    expect(theme!.issueIds).toEqual(expect.arrayContaining([id(1), id(2)]));
    expect(theme!.label).toMatch(/unreachable|management|retr/);
    expect(index.themeOf(id(2))).toBe(theme);
    expect(index.themeOf(id(7))).toBeUndefined();
  });

  it("only reports themes with at least two issues and a readable label", () => {
    for (const t of index.themes) {
      expect(t.issueIds.length).toBeGreaterThanOrEqual(2);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.label).not.toMatch(/\s{2,}/);
    }
  });

  it("is deterministic", () => {
    expect(buildSimilarity(CORPUS).themes).toEqual(index.themes);
    expect(buildSimilarity(CORPUS).related(id(1))).toEqual(index.related(id(1)));
  });

  it("returns nothing for unknown ids and degenerate inputs", () => {
    expect(index.related("netbirdio/netbird#999")).toEqual([]);
    expect(buildSimilarity([]).themes).toEqual([]);
    const one = buildSimilarity([CORPUS[0]]);
    expect(one.themes).toEqual([]);
    expect(one.related(CORPUS[0].id)).toEqual([]);
  });

  it("does not let issue-template boilerplate create links", () => {
    const template =
      "Describe the problem. Please attach a file and screenshots to help with troubleshooting. Expected behavior, steps to reproduce, additional context.";
    const issues = [
      ...CORPUS,
      mk(20, "Cannot rename a group", template),
      mk(21, "Billing page shows wrong currency", template),
    ];
    const idx = buildSimilarity(issues);
    expect(idx.related(id(20)).map((m) => m.id)).not.toContain(id(21));
  });

  it("does not link issues that only share description wording, however similar it is", () => {
    // Identical, distinctive bodies but unrelated titles: description text alone is not trusted.
    const body = "orchid zeppelin quartz marble violin saxophone orchid zeppelin quartz marble violin saxophone";
    const issues = [...CORPUS, mk(30, "Alpha widget crashes", body), mk(31, "Beta gadget stalls", body)];
    const idx = buildSimilarity(issues);
    expect(idx.related(id(30)).map((m) => m.id)).not.toContain(id(31));
    expect(idx.themeOf(id(30))).toBeUndefined();
  });

  it("caps how large a theme can grow, splitting a big group instead of dropping it", () => {
    // Unrelated filler with unique vocabulary keeps the shared words from being 'too common'.
    const words = ["apricot", "bicycle", "cactus", "dolphin", "eclipse", "falcon", "glacier", "harbor", "island", "jungle", "kettle", "lantern", "meadow", "nebula", "oyster", "pebble"];
    const filler = words.map((w, i) => mk(200 + i, `Question about ${w} behavior`, `${w} ${w} details`));
    const same = Array.from({ length: 12 }, (_, i) =>
      mk(100 + i, `Reverse proxy tls passthrough variant ${i}`, "reverse proxy tls passthrough listener certificate"),
    );
    const idx = buildSimilarity([...CORPUS, ...filler, ...same], { maxThemeSize: 6 });
    const proxyThemes = idx.themes.filter((t) => t.issueIds.some((m) => Number(m.split("#")[1]) >= 100 && Number(m.split("#")[1]) < 200));
    // 12 near-identical issues cannot fit in one theme of at most 6, so they must form several.
    expect(proxyThemes.length).toBeGreaterThanOrEqual(2);
    for (const t of idx.themes) expect(t.issueIds.length).toBeLessThanOrEqual(6);
  });

  it("works on the bundled sample issues without throwing and with sane output", () => {
    const issues = getSampleIssues();
    const idx = buildSimilarity(issues);
    const ids = new Set(issues.map((i) => i.id));
    for (const t of idx.themes) for (const m of t.issueIds) expect(ids.has(m)).toBe(true);
    for (const i of issues) for (const m of idx.related(i.id)) expect(ids.has(m.id)).toBe(true);
  });
});
