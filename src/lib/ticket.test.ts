import { describe, expect, it } from "vitest";
import { getSampleIssues } from "@/data/sample";
import { categorize, CATEGORIES } from "./categorize";
import { draftTicket, ticketToMarkdown } from "./ticket";

const sample = getSampleIssues();
const sso = sample.find((i) => i.number === 5513)!;
const scores = { impact: 4, urgency: 3, effort: 3 };

describe("draftTicket", () => {
  it("is deterministic", () => {
    const c = categorize(sso);
    expect(draftTicket(sso, c, scores)).toEqual(draftTicket(sso, c, scores));
  });

  it("produces every required section for the case-study issue", () => {
    const draft = draftTicket(sso, categorize(sso), scores);
    expect(draft.problemStatement).toContain("netbirdio/netbird#5513");
    expect(draft.userStory).toMatch(/^As an? /);
    expect(draft.acceptanceCriteria.length).toBeGreaterThanOrEqual(3);
    expect(draft.qaScenarios.length).toBeGreaterThanOrEqual(3);
    expect(draft.qaScenarios[0].title).toMatch(/still reproduces/i);
  });

  it("never presents the report as verified", () => {
    const draft = draftTicket(sso, categorize(sso), scores);
    expect(draft.problemStatement).toMatch(/unverified/i);
    expect(draft.problemStatement).toMatch(/not verified/i);
    expect(draft.assumptions.join(" ")).toMatch(/not been reproduced/i);
  });

  it("produces a complete draft for every category and for uncategorized issues", () => {
    for (const category of CATEGORIES) {
      const draft = draftTicket(sso, { primary: category, matches: [] }, scores);
      expect(draft.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(draft.qaScenarios.length).toBeGreaterThan(1);
    }
    const generic = draftTicket(sso, { primary: null, matches: [] }, scores);
    expect(generic.title.startsWith("Triage:")).toBe(true);
    expect(generic.problemStatement).toContain("Uncategorized");
  });

  it("does not duplicate a 'Feature:' prefix in the ticket title", () => {
    const feature = sample.find((i) => i.number === 446)!;
    expect(draftTicket(feature, { primary: "feature-request", matches: [] }, scores).title).toMatch(/^Feature: (?!Feature:)/);
  });
});

describe("ticketToMarkdown", () => {
  it("renders headings, checkboxes, and the source link", () => {
    const md = ticketToMarkdown(draftTicket(sso, categorize(sso), scores), sso);
    expect(md).toContain("## Problem statement");
    expect(md).toContain("## User story");
    expect(md).toContain("## Acceptance criteria");
    expect(md).toContain("## QA test scenarios");
    expect(md).toContain("- [ ] ");
    expect(md).toContain(sso.url);
  });
});
