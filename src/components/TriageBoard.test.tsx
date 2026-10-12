import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { getSampleIssues } from "@/data/sample";
import { TriageBoard } from "./TriageBoard";

const issues = getSampleIssues();
const NOW = "2026-10-12T12:00:00Z";
const KEY = "nbpl:score-overrides:v1";

function setup() {
  return render(<TriageBoard issues={issues} nowIso={NOW} />);
}

beforeEach(() => {
  window.localStorage.clear();
  // The board mirrors its filters in the URL, so each test must start from the default address.
  window.history.replaceState(null, "", "/");
});

describe("TriageBoard", () => {
  it("lists every issue with title, source link, labels, date, and description", () => {
    setup();
    expect(screen.getByText(`Showing ${issues.length} of ${issues.length} issues`)).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Issues" });
    expect(within(list).getAllByRole("article")).toHaveLength(issues.length);

    // The detail panel defaults to the first issue and exposes the source URL, labels, and description.
    const detail = screen.getByRole("complementary", { name: /selected issue/i });
    const link = within(detail).getByRole("link", { name: /view the source on github/i });
    expect(link).toHaveAttribute("href", expect.stringMatching(/^https:\/\/github\.com\/netbirdio\/(netbird|dashboard)\/issues\/\d+$/));
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(detail).getByText(/created/i)).toBeInTheDocument();
    expect(within(detail).getByRole("heading", { name: "Description (reporter’s words, shown as plain text)" })).toBeInTheDocument();
  });

  it("filters by category and reports the new count", async () => {
    const user = userEvent.setup();
    setup();
    const group = screen.getByRole("group", { name: /filter by category/i });
    const docs = within(group).getByRole("button", { name: /^Documentation/ });
    await user.click(docs);
    expect(docs).toHaveAttribute("aria-pressed", "true");
    const list = screen.getByRole("list", { name: "Issues" });
    const shown = within(list).getAllByRole("article");
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(issues.length);
    expect(screen.getByText(new RegExp(`Showing ${shown.length} of ${issues.length} issues`))).toBeInTheDocument();
  });

  it("filters by repository", async () => {
    const user = userEvent.setup();
    setup();
    await user.selectOptions(screen.getByLabelText("Repository"), "netbirdio/dashboard");
    const dashboardCount = issues.filter((i) => i.repo === "netbirdio/dashboard").length;
    expect(within(screen.getByRole("list", { name: "Issues" })).getAllByRole("article")).toHaveLength(dashboardCount);
  });

  it("shows an empty state with a way out when nothing matches", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Search"), "zzzz-no-such-issue");
    expect(screen.getByText("No issues match these filters")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(screen.queryByText("No issues match these filters")).not.toBeInTheDocument();
    expect(screen.getByText(`Showing ${issues.length} of ${issues.length} issues`)).toBeInTheDocument();
  });

  it("shows an empty state when there are no issues at all", () => {
    render(<TriageBoard issues={[]} nowIso={NOW} />);
    expect(screen.getByText("No open issues found")).toBeInTheDocument();
  });

  it("lets the user edit a score, marks it as edited, saves it locally, and can reset", async () => {
    const user = userEvent.setup();
    setup();
    const detail = screen.getByRole("complementary", { name: /selected issue/i });
    const effort = within(detail).getByRole("slider", { name: /effort/i });
    expect(within(detail).getAllByText(/Suggested \(inferred, unverified\)/)).toHaveLength(3);

    fireEvent.change(effort, { target: { value: "5" } });

    expect(within(detail).getByText("Edited by you")).toBeInTheDocument();
    expect(within(detail).getAllByText(/Suggested \(inferred, unverified\)/)).toHaveLength(2);
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    expect(Object.values(saved)[0]).toEqual({ effort: 5 });

    await user.click(within(detail).getByRole("button", { name: "Reset to suggested" }));
    expect(within(detail).queryByText("Edited by you")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "{}")).toEqual({});
  });

  it("restores saved edits on load", () => {
    const first = issues[0];
    window.localStorage.setItem(KEY, JSON.stringify({ [first.id]: { impact: 5 } }));
    setup();
    // Sorted by priority, the edited issue may not be first; its card is flagged either way.
    expect(screen.getByText("Scores edited")).toBeInTheDocument();
  });

  it("survives corrupted or hostile saved data", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(() => setup()).not.toThrow();
    expect(screen.getByText(`Showing ${issues.length} of ${issues.length} issues`)).toBeInTheDocument();

    window.localStorage.setItem(KEY, JSON.stringify({ [issues[0].id]: { impact: 999, urgency: "x" } }));
    expect(() => render(<TriageBoard issues={issues} nowIso={NOW} />)).not.toThrow();
  });

  it("generates a ticket draft with all required sections for the selected issue", () => {
    setup();
    const detail = screen.getByRole("complementary", { name: /selected issue/i });
    for (const heading of ["Problem statement", "User story", "Acceptance criteria", "QA test scenarios"]) {
      expect(within(detail).getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(within(detail).getByRole("button", { name: "Copy as Markdown" })).toBeInTheDocument();
  });

  it("switches the detail panel when another issue is selected", async () => {
    const user = userEvent.setup();
    setup();
    const list = screen.getByRole("list", { name: "Issues" });
    const target = within(list).getAllByRole("article")[1];
    const titleButton = within(target).getByRole("button");
    await user.click(titleButton);
    const detail = screen.getByRole("complementary", { name: /selected issue/i });
    expect(within(detail).getByRole("heading", { level: 2 })).toHaveTextContent(titleButton.textContent ?? "");
  });
});
