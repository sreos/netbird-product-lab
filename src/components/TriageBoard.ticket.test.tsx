import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { getSampleIssues } from "@/data/sample";
import { TriageBoard } from "./TriageBoard";

const issues = getSampleIssues();
const NOW = "2026-10-12T12:00:00Z";
const KEY = "nbpl:ticket-edits:v1";

const ticket = () => screen.getByRole("region", { name: "Ticket draft" });
const markdown = () => (within(ticket()).getByLabelText("Ticket draft as Markdown") as HTMLTextAreaElement).value;

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("editable ticket draft", () => {
  it("lets the user edit a section, shows it as edited, and puts it in the Markdown", async () => {
    const user = userEvent.setup();
    render(<TriageBoard issues={issues} nowIso={NOW} />);

    await user.click(within(ticket()).getByRole("button", { name: "Edit draft" }));
    const story = within(ticket()).getByLabelText("User story");
    await user.clear(story);
    await user.type(story, "As a tester, I want clear status.");

    // The whole sentence arrived: typing did not lose focus or characters on re-render.
    expect(story).toHaveValue("As a tester, I want clear status.");
    expect(within(ticket()).getByText("Edited by you")).toBeInTheDocument();

    await user.click(within(ticket()).getByRole("button", { name: "Done editing" }));
    expect(within(ticket()).getByText("As a tester, I want clear status.")).toBeInTheDocument();
    expect(markdown()).toContain("As a tester, I want clear status.");
    expect(within(ticket()).getByText(/You edited:/).closest("p")).toHaveTextContent(/You edited:\s*User story/);
  });

  it("keeps unedited sections following the scores, and freezes edited ones", async () => {
    const user = userEvent.setup();
    render(<TriageBoard issues={issues} nowIso={NOW} />);
    await user.click(within(ticket()).getByRole("button", { name: "Edit draft" }));
    await user.type(within(ticket()).getByLabelText("User story"), " (edited)");
    await user.click(within(ticket()).getByRole("button", { name: "Done editing" }));

    fireEvent.change(screen.getByRole("slider", { name: /impact/i }), { target: { value: "5" } });

    // Problem statement is untouched, so it reflects the new impact score.
    expect(markdown()).toMatch(/impact 5\/5/);
    // The edited user story is preserved.
    expect(markdown()).toContain("(edited)");
  });

  it("resets one section", async () => {
    const user = userEvent.setup();
    render(<TriageBoard issues={issues} nowIso={NOW} />);
    await user.click(within(ticket()).getByRole("button", { name: "Edit draft" }));
    await user.type(within(ticket()).getByLabelText("User story"), " MARKER");
    expect(markdown()).toContain("MARKER");

    await user.click(within(ticket()).getByRole("button", { name: /reset section: user story/i }));
    expect(markdown()).not.toContain("MARKER");
    expect(window.localStorage.getItem(KEY)).toBe("{}");
  });

  it("asks before discarding all edits, and can be cancelled", async () => {
    const user = userEvent.setup();
    render(<TriageBoard issues={issues} nowIso={NOW} />);
    await user.click(within(ticket()).getByRole("button", { name: "Edit draft" }));
    await user.type(within(ticket()).getByLabelText("User story"), " KEEPME");
    await user.click(within(ticket()).getByRole("button", { name: "Done editing" }));

    await user.click(within(ticket()).getByRole("button", { name: "Regenerate from template" }));
    await user.click(within(ticket()).getByRole("button", { name: "Keep my edits" }));
    expect(markdown()).toContain("KEEPME");

    await user.click(within(ticket()).getByRole("button", { name: "Regenerate from template" }));
    await user.click(within(ticket()).getByRole("button", { name: "Yes, regenerate" }));
    expect(markdown()).not.toContain("KEEPME");
    expect(within(ticket()).queryByText(/You edited:/)).not.toBeInTheDocument();
  });

  it("adds and removes QA scenarios, ignoring a scenario left empty", async () => {
    const user = userEvent.setup();
    render(<TriageBoard issues={issues} nowIso={NOW} />);
    await user.click(within(ticket()).getByRole("button", { name: "Edit draft" }));
    const before = (markdown().match(/^### \d+\./gm) ?? []).length;

    await user.click(within(ticket()).getByRole("button", { name: "Add scenario" }));
    // Empty new scenario: still the same number of scenarios in the output.
    expect((markdown().match(/^### \d+\./gm) ?? []).length).toBe(before);

    await user.type(within(ticket()).getByLabelText("Title", { selector: `[id$="-s${before}-title"]` }), "Custom check");
    expect((markdown().match(/^### \d+\./gm) ?? []).length).toBe(before + 1);
    expect(markdown()).toContain("Custom check");

    await user.click(within(ticket()).getByRole("button", { name: `Remove scenario ${before + 1}` }));
    expect(markdown()).not.toContain("Custom check");
  });

  it("saves edits in this browser and restores them on load", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TriageBoard issues={issues} nowIso={NOW} />);
    await user.click(within(ticket()).getByRole("button", { name: "Edit draft" }));
    await user.type(within(ticket()).getByLabelText("Ticket title"), " PERSISTED");
    unmount();

    render(<TriageBoard issues={issues} nowIso={NOW} />);
    expect(markdown()).toContain("PERSISTED");
  });

  it("survives corrupted or hostile saved data", () => {
    const id = issues[0].id;
    window.localStorage.setItem(KEY, JSON.stringify({ [id]: { title: 123, qaScenarios: "x" }, other: "junk" }));
    expect(() => render(<TriageBoard issues={issues} nowIso={NOW} />)).not.toThrow();
    expect(within(ticket()).queryByText(/You edited:/)).not.toBeInTheDocument();
  });
});
