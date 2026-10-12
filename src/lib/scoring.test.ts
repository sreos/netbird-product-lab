import { describe, expect, it } from "vitest";
import { categorize } from "./categorize";
import { clampScore, priorityBand, priorityScore, resolveScores, suggestScores } from "./scoring";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const base = { title: "Peer link is being dropped", body: "", comments: 0, updatedAt: "2025-01-01T00:00:00Z" };

describe("priority model", () => {
  it("computes (impact × urgency) ÷ effort, rounded to one decimal", () => {
    expect(priorityScore({ impact: 4, urgency: 4, effort: 2 })).toBe(8);
    expect(priorityScore({ impact: 3, urgency: 3, effort: 3 })).toBe(3);
    expect(priorityScore({ impact: 1, urgency: 2, effort: 3 })).toBe(0.7);
  });

  it("maps scores to bands at the documented thresholds", () => {
    expect(priorityBand(8)).toBe("high");
    expect(priorityBand(7.9)).toBe("medium");
    expect(priorityBand(3)).toBe("medium");
    expect(priorityBand(2.9)).toBe("low");
  });

  it("clamps and rounds inputs to the 1–5 scale", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(9)).toBe(5);
    expect(clampScore(3.4)).toBe(3);
    expect(clampScore(Number.NaN)).toBe(3);
  });
});

describe("suggestScores", () => {
  it("never infers effort: it is always the neutral default with an explanation", () => {
    const s = suggestScores(base, categorize({ ...base, labels: ["bug"] }), NOW);
    expect(s.scores.effort).toBe(3);
    expect(s.rationale.effort[0]).toMatch(/cannot be inferred/i);
  });

  it("explains every adjustment it makes", () => {
    const recent = { ...base, comments: 31, updatedAt: "2026-10-01T00:00:00Z", body: "It crashes silently." };
    const s = suggestScores(recent, categorize({ ...recent, labels: ["bug", "connection"] }), NOW);
    expect(s.scores.impact).toBe(5);
    expect(s.rationale.impact.length).toBe(4); // base + category + 5 comments + 15 comments
    expect(s.scores.urgency).toBe(5);
    expect(s.rationale.urgency.length).toBe(4);
  });

  it("stays at the neutral baseline when there are no signals", () => {
    const quiet = { title: "Question", body: "", comments: 0, updatedAt: "2024-01-01T00:00:00Z" };
    const s = suggestScores(quiet, categorize({ ...quiet, labels: [] }), NOW);
    expect(s.scores).toEqual({ impact: 2, urgency: 2, effort: 3 });
  });

  it("is deterministic for a fixed clock", () => {
    const c = categorize({ ...base, labels: ["bug"] });
    expect(suggestScores(base, c, NOW)).toEqual(suggestScores(base, c, NOW));
  });
});

describe("resolveScores", () => {
  it("applies per-field overrides on top of suggestions", () => {
    const suggested = { impact: 2, urgency: 2, effort: 3 };
    expect(resolveScores(suggested, { effort: 5 })).toEqual({ impact: 2, urgency: 2, effort: 5 });
    expect(resolveScores(suggested)).toEqual(suggested);
  });

  it("sanitizes out-of-range overrides (e.g. from tampered localStorage)", () => {
    expect(resolveScores({ impact: 2, urgency: 2, effort: 3 }, { impact: 99, urgency: -4 })).toEqual({
      impact: 5,
      urgency: 1,
      effort: 3,
    });
  });
});
