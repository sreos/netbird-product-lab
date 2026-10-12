import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { Issue } from "@/lib/types";
import { TriageBoard } from "./TriageBoard";

const mk = (n: number, title: string, body = "", labels: string[] = []): Issue => ({
  id: `netbirdio/netbird#${n}`,
  repo: "netbirdio/netbird",
  number: n,
  title,
  url: `https://github.com/netbirdio/netbird/issues/${n}`,
  labels,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-09-20T00:00:00Z",
  comments: n,
  body,
  bodyTruncated: false,
});

// #1 and #2 describe the same failure; #3 and #4 share a rare title word; the rest are unrelated filler.
const ISSUES: Issue[] = [
  mk(1, "Client memory keeps growing while Management is unreachable", "The client retries forever and the memory leak grows when management is unreachable."),
  mk(2, "Signal stream never retries after outage while Management unreachable", "After a network outage the stream does not retry, management stays unreachable for the client."),
  mk(3, "High latency", "Pings are slow on my link."),
  mk(4, "Large latency spikes at night", "Latency jumps in the evening for remote peers."),
  mk(5, "Add dark theme contrast options", "The theme is hard to read, contrast is too low.", ["enhancement"]),
  mk(6, "Windows installer msi fails on upgrade", "The msi installer aborts when upgrading an existing version."),
  mk(7, "Typo in the readme quickstart", "A word is misspelled in the quickstart section.", ["documentation"]),
  mk(8, "Export audit events to CSV", "Please allow exporting the audit log as a spreadsheet."),
  mk(9, "Rotate setup keys automatically", "Setup keys should expire and rotate on a schedule."),
  mk(10, "Mobile app crashes on launch", "The android application closes right after the splash screen."),
  mk(11, "Slow search on large peer lists", "Searching among thousands of peers is sluggish."),
  mk(12, "Cannot upload organization logo", "Uploading a png logo returns a validation error."),
];
const NOW = "2026-10-12T12:00:00Z";
const setUrl = (path: string) => window.history.replaceState(null, "", path);
const detail = () => screen.getByRole("complementary", { name: /selected issue/i });
const listItems = () => within(screen.getByRole("list", { name: "Issues" })).getAllByRole("article");
const themeButtons = () => within(screen.getByRole("list", { name: "Themes" })).getAllByRole("button");

beforeEach(() => {
  window.localStorage.clear();
  setUrl("/");
});

describe("themes", () => {
  it("lists possible themes with a plain statement that they are based on wording", () => {
    render(<TriageBoard issues={ISSUES} nowIso={NOW} />);
    expect(screen.getByText(/Issues grouped by/)).toHaveTextContent(/not by meaning/i);
    expect(themeButtons().length).toBeGreaterThanOrEqual(2);
  });

  it("filters the list to a theme, records it in the URL, and toggles off", async () => {
    const user = userEvent.setup();
    render(<TriageBoard issues={ISSUES} nowIso={NOW} />);

    const reliability = themeButtons().find((b) => /unreachable|management/.test(b.textContent ?? ""))!;
    expect(reliability).toBeDefined();
    await user.click(reliability);

    expect(reliability).toHaveAttribute("aria-pressed", "true");
    expect(listItems()).toHaveLength(2);
    expect(window.location.search).toMatch(/theme=netbird-1/);
    expect(screen.getByText(/Showing 2 of 12 issues/)).toBeInTheDocument();

    await user.click(reliability);
    expect(listItems()).toHaveLength(12);
    expect(window.location.search).not.toContain("theme=");
  });

  it("clears the theme with Clear filters", async () => {
    const user = userEvent.setup();
    render(<TriageBoard issues={ISSUES} nowIso={NOW} />);
    await user.click(themeButtons()[0]);
    expect(listItems().length).toBeLessThan(12);
    await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(listItems()).toHaveLength(12);
  });

  it("restores a theme from a shared link, and opens the themes panel so it is visible", () => {
    setUrl("/?theme=netbird-1");
    render(<TriageBoard issues={ISSUES} nowIso={NOW} />);
    expect(listItems()).toHaveLength(2);
    expect(screen.getByText(/Possible themes/).closest("details")).toHaveAttribute("open");
  });

  it("ignores a theme from a stale link that no longer exists", () => {
    setUrl("/?theme=netbird-9999");
    render(<TriageBoard issues={ISSUES} nowIso={NOW} />);
    expect(listItems()).toHaveLength(12);
    expect(window.location.search).not.toContain("theme=");
  });
});

describe("related issues", () => {
  it("shows related issues with the shared words and a clear caveat", () => {
    setUrl("/?issue=netbird-1");
    render(<TriageBoard issues={ISSUES} nowIso={NOW} />);
    const section = within(detail()).getByRole("region", { name: "Possibly related issues" });
    expect(within(section).getByText(/shared wording only/i)).toBeInTheDocument();
    expect(within(section).getByText(/never treat these as confirmed duplicates/i)).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: /Signal stream never retries/ })).toBeInTheDocument();
    expect(within(section).getByText(/shared words:/)).toBeInTheDocument();
  });

  it("says so honestly when nothing is related", () => {
    setUrl("/?issue=netbird-7");
    render(<TriageBoard issues={ISSUES} nowIso={NOW} />);
    const section = within(detail()).getByRole("region", { name: "Possibly related issues" });
    expect(within(section).getByText(/does not mean none exists/i)).toBeInTheDocument();
  });

  it("jumps to a related issue", async () => {
    const user = userEvent.setup();
    setUrl("/?issue=netbird-1");
    render(<TriageBoard issues={ISSUES} nowIso={NOW} />);
    await user.click(within(detail()).getByRole("button", { name: /Signal stream never retries/ }));
    expect(within(detail()).getByRole("heading", { level: 2 })).toHaveTextContent("Signal stream never retries");
    expect(window.location.search).toContain("issue=netbird-2");
  });

  it("drops a filter that would hide the related issue, instead of showing something else", async () => {
    const user = userEvent.setup();
    setUrl("/?issue=netbird-1");
    render(<TriageBoard issues={ISSUES} nowIso={NOW} />);

    // Search for a word only #1 contains: the list narrows to #1 and #2 is hidden.
    await user.type(screen.getByLabelText("Search"), "memory");
    expect(listItems()).toHaveLength(1);
    expect(within(detail()).getByRole("heading", { level: 2 })).toHaveTextContent("Client memory keeps growing");

    // Following the link to #2 must clear the search so that #2 is actually visible and selected.
    await user.click(within(detail()).getByRole("button", { name: /Signal stream never retries/ }));
    expect(screen.getByLabelText("Search")).toHaveValue("");
    expect(listItems()).toHaveLength(12);
    expect(within(detail()).getByRole("heading", { level: 2 })).toHaveTextContent("Signal stream never retries");
  });

  it("offers Show only this theme for an issue in a theme, and applies it", async () => {
    const user = userEvent.setup();
    setUrl("/?issue=netbird-1");
    render(<TriageBoard issues={ISSUES} nowIso={NOW} />);
    await user.click(within(detail()).getByRole("button", { name: "Show only this theme" }));
    expect(listItems()).toHaveLength(2);
    expect(within(detail()).getByText(/Showing this theme in the list/)).toBeInTheDocument();
  });
});
