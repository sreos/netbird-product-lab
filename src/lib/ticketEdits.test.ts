import { describe, expect, it } from "vitest";
import { getSampleIssues } from "@/data/sample";
import { categorize } from "./categorize";
import { draftTicket } from "./ticket";
import { applyEdits, editableFromDraft, sanitizeEdits, textToLines, withEdit, withoutEdit } from "./ticketEdits";

const issue = getSampleIssues().find((i) => i.number === 5513)!;
const generate = (impact = 3) => draftTicket(issue, categorize(issue), { impact, urgency: 3, effort: 3 });

describe("textToLines", () => {
  it("drops blank lines and pasted list markers", () => {
    expect(textToLines("- one\n\n* two\n3. three\n- [ ] four\n[x] five\n   \n  six  ")).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
    ]);
  });
});

describe("applyEdits", () => {
  it("returns the template draft unchanged when there are no edits", () => {
    const draft = generate();
    expect(applyEdits(draft, undefined)).toBe(draft);
  });

  it("applies only the edited sections; the rest keep following the template", () => {
    const edits = { userStory: "As a tester, I want a thing." };
    const low = applyEdits(generate(1), edits);
    const high = applyEdits(generate(5), edits);
    expect(low.userStory).toBe("As a tester, I want a thing.");
    expect(high.userStory).toBe("As a tester, I want a thing.");
    // The problem statement was not edited, so it still reflects the scores.
    expect(low.problemStatement).toContain("impact 1/5");
    expect(high.problemStatement).toContain("impact 5/5");
  });

  it("parses list sections into trimmed lines", () => {
    const out = applyEdits(generate(), { acceptanceCriteria: "- first\n\n- second  ", assumptions: "only one" });
    expect(out.acceptanceCriteria).toEqual(["first", "second"]);
    expect(out.assumptions).toEqual(["only one"]);
  });

  it("falls back to the template title when the edited title is blank", () => {
    const draft = generate();
    expect(applyEdits(draft, { title: "   " }).title).toBe(draft.title);
  });

  it("leaves out scenarios that were added but never filled in, and names untitled ones", () => {
    const out = applyEdits(generate(), {
      qaScenarios: [
        { title: "", steps: "", expected: "" },
        { title: "", steps: "do a thing", expected: "" },
        { title: "Real", steps: "1. step", expected: " ok " },
      ],
    });
    expect(out.qaScenarios).toEqual([
      { title: "Untitled scenario", steps: ["do a thing"], expected: "" },
      { title: "Real", steps: ["step"], expected: "ok" },
    ]);
  });
});

describe("withEdit / withoutEdit", () => {
  it("records a change and removes it again when it matches the template", () => {
    const generated = generate();
    const original = editableFromDraft(generated).userStory;

    const edited = withEdit(undefined, generated, "userStory", "Something else");
    expect(edited).toEqual({ userStory: "Something else" });

    // Typing it back to exactly what the template produces clears the "edited" state.
    expect(withEdit(edited, generated, "userStory", original)).toBeUndefined();
  });

  it("keeps other edits when one is reverted", () => {
    const generated = generate();
    const both = withEdit({ title: "My title" }, generated, "userStory", "Mine");
    expect(withEdit(both, generated, "userStory", editableFromDraft(generated).userStory)).toEqual({ title: "My title" });
  });

  it("removes a single section with withoutEdit", () => {
    expect(withoutEdit({ title: "a", userStory: "b" }, "title")).toEqual({ userStory: "b" });
    expect(withoutEdit({ title: "a" }, "title")).toBeUndefined();
    expect(withoutEdit(undefined, "title")).toBeUndefined();
  });
});

describe("sanitizeEdits (stored data is untrusted)", () => {
  it("accepts a well-formed entry", () => {
    const entry = { title: "t", qaScenarios: [{ title: "a", steps: "b", expected: "c" }] };
    expect(sanitizeEdits(entry)).toEqual(entry);
  });

  it("drops fields with the wrong type or an absurd size", () => {
    expect(sanitizeEdits({ title: 5, userStory: { x: 1 }, assumptions: "x".repeat(5000) })).toBeNull();
    expect(sanitizeEdits({ title: "ok", userStory: 42 })).toEqual({ title: "ok" });
  });

  it("rejects the whole scenario list if any entry is malformed", () => {
    expect(sanitizeEdits({ qaScenarios: [{ title: "a", steps: "b", expected: "c" }, { title: 1 }] })).toBeNull();
    expect(sanitizeEdits({ qaScenarios: "nope" })).toBeNull();
    expect(sanitizeEdits({ qaScenarios: Array.from({ length: 50 }, () => ({ title: "a", steps: "", expected: "" })) })).toBeNull();
  });

  it("rejects non-objects", () => {
    for (const bad of [null, undefined, 5, "str", true]) expect(sanitizeEdits(bad)).toBeNull();
  });
});
