import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { TrendRow } from "@/lib/trends";
import { TrendsView } from "./TrendsView";

const NOW = "2026-10-12T12:00:00Z";
const row = (n: number, createdAt: string, series: TrendRow["series"], over: Partial<TrendRow> = {}): TrendRow => ({
  id: `netbirdio/netbird#${n}`,
  repo: "netbirdio/netbird",
  createdAt,
  series,
  comments: n,
  needsTriage: false,
  ...over,
});

const ROWS: TrendRow[] = [
  row(1, "2026-10-02T00:00:00Z", "bug", { needsTriage: true }),
  row(2, "2026-10-05T00:00:00Z", "bug"),
  row(3, "2026-10-09T00:00:00Z", "reliability"),
  row(4, "2026-09-15T00:00:00Z", "ux", { repo: "netbirdio/dashboard", id: "netbirdio/dashboard#4", needsTriage: true }),
  row(5, "2026-01-20T00:00:00Z", "documentation"),
  row(6, "2024-03-01T00:00:00Z", "feature-request"), // older than any preset except 24 months? No: > 24 months
];

const group = () => screen.getByRole("group", { name: /Stacked column chart/ });
// jsdom builds PointerEvents without coordinates, so dispatch a MouseEvent named "pointermove" instead.
const pointerAt = (el: Element, clientX: number) =>
  fireEvent(el, new MouseEvent("pointermove", { bubbles: true, clientX }));

function setup(rows = ROWS) {
  return render(<TrendsView rows={rows} nowIso={NOW} />);
}

describe("TrendsView", () => {
  it("shows figures for the issues in view", () => {
    setup();
    const figures = screen.getByRole("region", { name: "Key figures" });
    // 5 issues fall inside the last 12 months; the 2024 one is older.
    expect(within(figures).getByText("Issues in view").nextElementSibling).toHaveTextContent("5");
    expect(within(figures).getByText("Labelled as needing triage").nextElementSibling).toHaveTextContent("2 of 5");
  });

  it("says how many issues fall outside the range instead of silently dropping them", () => {
    setup();
    expect(screen.getByText(/1 more issue was created before this range and is not charted/)).toBeInTheDocument();
  });

  it("always shows a legend with counts, and lets series be hidden without ever hiding the last one", async () => {
    const user = userEvent.setup();
    setup();
    const legend = screen.getByRole("list", { name: /Legend/ });
    const buttons = within(legend).getAllByRole("button");
    expect(buttons).toHaveLength(6);
    expect(within(legend).getByRole("button", { name: /^Bug 2$/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(legend).getByRole("button", { name: /^Bug/ }));
    expect(within(legend).getByRole("button", { name: /^Bug/ })).toHaveAttribute("aria-pressed", "false");

    // Hide everything else too: the last remaining series must stay visible.
    for (const b of buttons) if (b.getAttribute("aria-pressed") === "true") await user.click(b);
    const stillShown = within(legend).getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(stillShown).toHaveLength(1);
  });

  it("keeps the same count on a series' legend entry when it is hidden (colors and numbers do not change)", async () => {
    const user = userEvent.setup();
    setup();
    const legend = screen.getByRole("list", { name: /Legend/ });
    await user.click(within(legend).getByRole("button", { name: /^Reliability/ }));
    expect(within(legend).getByRole("button", { name: /^Reliability/ })).toHaveTextContent("1");
  });

  it("switches to an accessible table with the same numbers", async () => {
    const user = userEvent.setup();
    setup();
    const toggle = screen.getByRole("button", { name: "View as table" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);

    expect(screen.getByRole("button", { name: "View as chart" })).toHaveAttribute("aria-pressed", "true");
    const table = screen.getByRole("table", { name: "Issues created per month by category" });
    const octRow = within(table).getByRole("row", { name: /Oct 2026/ });
    const cells = within(octRow).getAllByRole("cell").map((c) => c.textContent);
    // Bug, Reliability, UX, Documentation, Feature request, Uncategorized, Total
    expect(cells).toEqual(["2", "1", "0", "0", "0", "0", "3"]);
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 12);
  });

  it("changes every number when the time range changes", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByLabelText("Last 6 months"));
    const figures = screen.getByRole("region", { name: "Key figures" });
    // Jan 2026 is more than six months before Oct 2026, so only the four recent issues remain.
    expect(within(figures).getByText("Issues in view").nextElementSibling).toHaveTextContent("4");

    await user.click(screen.getByLabelText("Last 24 months"));
    expect(within(figures).getByText("Issues in view").nextElementSibling).toHaveTextContent("5");
  });

  it("applies the repository filter to the figures and the category table", async () => {
    const user = userEvent.setup();
    setup();
    await user.selectOptions(screen.getByLabelText("Repository"), "netbirdio/dashboard");
    const figures = screen.getByRole("region", { name: "Key figures" });
    expect(within(figures).getByText("Issues in view").nextElementSibling).toHaveTextContent("1");
    const table = screen.getByRole("table", { name: /by primary category/i });
    expect(within(within(table).getByRole("row", { name: /^UX/ })).getAllByRole("cell")[0]).toHaveTextContent("1");
  });

  it("lists categories in the fixed order with shares and median ages", () => {
    setup();
    const table = screen.getByRole("table", { name: /by primary category/i });
    const names = within(table).getAllByRole("row").slice(1).map((r) => within(r).getByRole("rowheader").textContent);
    expect(names).toEqual(["Bug", "Reliability", "UX", "Documentation", "Feature request", "Uncategorized"]);
    const bug = within(within(table).getByRole("row", { name: /^Bug/ })).getAllByRole("cell").map((c) => c.textContent);
    expect(bug[0]).toBe("2"); // issues
    expect(bug[1]).toBe("40%"); // share of 5
  });

  it("announces the latest month when the chart is focused and moves with the arrow keys", async () => {
    const user = userEvent.setup();
    setup();
    await act(async () => group().focus());
    const status = screen.getAllByRole("status").find((el) => el.className.includes("sr-only"))!;
    expect(status).toHaveTextContent(/Oct 2026: 3 issues\. Bug 2, Reliability 1/);

    await user.keyboard("{ArrowLeft}");
    expect(status).toHaveTextContent(/Sep 2026: 1 issue\. UX 1/);
    await user.keyboard("{Home}");
    expect(status).toHaveTextContent(/Nov 2025: 0 issues/);
    await user.keyboard("{End}");
    expect(status).toHaveTextContent(/Oct 2026/);
  });

  it("shows one tooltip listing every visible series for the hovered month", () => {
    setup();
    // 12 columns across the plot; the last column is the current month.
    pointerAt(group(), 40 + 56 * 11 + 10);
    const tip = group().querySelector("div[aria-hidden='true']") as HTMLElement;
    expect(tip).toBeTruthy();
    expect(tip.textContent).toContain("Oct 2026");
    expect(tip.textContent).toContain("Bug");
    expect(tip.textContent).toContain("Total");
    fireEvent.pointerLeave(group());
    expect(group().querySelector("div[aria-hidden='true']")).toBeNull();
  });

  it("limits the tooltip to the series that are shown", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(within(screen.getByRole("list", { name: /Legend/ })).getByRole("button", { name: /^Bug/ }));
    pointerAt(group(), 40 + 56 * 11 + 10);
    const tip = group().querySelector("div[aria-hidden='true']") as HTMLElement;
    expect(tip.textContent).not.toContain("Bug");
    expect(tip.textContent).toContain("Reliability");
  });

  it("announces the month under the pointer when the chart then receives keyboard focus", async () => {
    setup();
    pointerAt(group(), 40 + 56 * 2 + 10); // third column: Jan 2026
    await act(async () => group().focus());
    const status = screen.getAllByRole("status").find((el) => el.className.includes("sr-only"))!;
    expect(status).toHaveTextContent(/Jan 2026: 1 issue. Documentation 1/);
  });

  it("draws monthly totals on the columns", () => {
    const { container } = setup();
    const texts = [...container.querySelectorAll("svg text")].map((t) => t.textContent);
    expect(texts).toContain("3"); // October total
  });

  it("shows an empty state instead of a blank chart", async () => {
    const user = userEvent.setup();
    setup([row(6, "2024-03-01T00:00:00Z", "feature-request")]);
    expect(screen.getByText("No issues were created in this range")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Stacked column chart/ })).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Last 24 months"));
    expect(screen.getByText("No issues were created in this range")).toBeInTheDocument();
  });

  it("copes with no rows at all", () => {
    expect(() => setup([])).not.toThrow();
    expect(screen.getByText("No issues were created in this range")).toBeInTheDocument();
  });
});

describe("TrendsView honesty and layout details", () => {
  it("places the tooltip beside the hovered column, never over it", () => {
    setup();
    pointerAt(group(), 40 + 56 * 11 + 10); // the last column
    const tip = group().querySelector("div[aria-hidden='true']") as HTMLElement;
    const columnLeft = 40 + 56 * 11; // plot margin + 11 slots (width falls back to 720 in jsdom)
    expect(tip.style.transform).toBe("translateX(-100%)");
    // Its right edge sits left of the hovered column.
    expect(parseFloat(tip.style.left)).toBeLessThan(columnLeft);

    pointerAt(group(), 40 + 10); // the first column: tooltip goes to its right
    const tipFirst = group().querySelector("div[aria-hidden='true']") as HTMLElement;
    expect(tipFirst.style.transform).toBe("");
    expect(parseFloat(tipFirst.style.left)).toBeGreaterThan(40 + 56);
  });

  it("says that the current month is still in progress, in the tooltip, the announcement, and the table", async () => {
    const user = userEvent.setup();
    setup();
    pointerAt(group(), 40 + 56 * 11 + 10);
    expect((group().querySelector("div[aria-hidden='true']") as HTMLElement).textContent).toContain("Month in progress");
    pointerAt(group(), 40 + 10); // an earlier month has no such note
    expect((group().querySelector("div[aria-hidden='true']") as HTMLElement).textContent).not.toContain("Month in progress");
    fireEvent.pointerLeave(group());

    await act(async () => group().focus());
    const status = screen.getAllByRole("status").find((el) => el.className.includes("sr-only"))!;
    expect(status).toHaveTextContent(/This month is still in progress/);
    await user.keyboard("{ArrowLeft}");
    expect(status).not.toHaveTextContent(/still in progress/);

    await user.click(screen.getByRole("button", { name: "View as table" }));
    expect(screen.getByRole("row", { name: /Oct 2026 \(so far\)/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /^Sep 2026 / })).toBeInTheDocument();
  });
});
