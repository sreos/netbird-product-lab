import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSampleIssues } from "@/data/sample";

vi.mock("@/lib/github", () => ({ getIssue: vi.fn() }));

import { getIssue } from "@/lib/github";
import CaseStudiesIndex from "./page";
import Case5513 from "./5513/page";
import Case412 from "./dashboard-412/page";

const mockedGetIssue = vi.mocked(getIssue);
const sample = getSampleIssues();
const found = (repo: "netbirdio/netbird" | "netbirdio/dashboard", n: number) => {
  const issue = sample.find((i) => i.repo === repo && i.number === n)!;
  return { issue, source: "sample" as const, reason: "test" };
};

beforeEach(() => {
  mockedGetIssue.mockReset();
  mockedGetIssue.mockImplementation(async (repo, n) => found(repo, n));
});

describe("case study index", () => {
  it("links to both case studies and states how they are written", () => {
    render(<CaseStudiesIndex />);
    expect(screen.getByRole("heading", { level: 1, name: "Case studies" })).toBeInTheDocument();
    const hrefs = screen.getAllByRole("link", { name: "Read the case study" }).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/case-study/5513", "/case-study/dashboard-412"]);
    expect(screen.getByText(/never blended/i)).toBeInTheDocument();
    expect(screen.getByText(/independent of NetBird/i)).toBeInTheDocument();
  });
});

describe("case study 1: issue #5513", () => {
  it("still renders every section, after being moved onto the shared components", async () => {
    render(await Case5513());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Silent SSO session expiry/);
    for (const name of [
      "What the issue says",
      "Evidence and verification status",
      "Step 0: validate before building",
      "Problem framing and hypotheses",
      "Proposed requirements",
      "Mock connection-state UX",
      "Success metrics, risks, open questions",
      "Ticket draft from the Lab",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getAllByText(/^R[1-8]$/)).toHaveLength(8);
    expect(screen.getByText("Unknown")).toBeInTheDocument(); // the open question is labelled, not hidden
    expect(screen.getByRole("link", { name: /Case study 2/ })).toHaveAttribute("href", "/case-study/dashboard-412");
  });

  it("keeps working when the issue cannot be loaded", async () => {
    mockedGetIssue.mockResolvedValue(null);
    render(await Case5513());
    expect(screen.getByText(/Issue data is unavailable right now/)).toBeInTheDocument();
    expect(screen.getByText(/no draft was generated/)).toBeInTheDocument();
  });
});

describe("case study 2: dashboard issue #412", () => {
  it("renders every section with the independence and limits notices", async () => {
    render(await Case412());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/light theme request open for two years/i);
    for (const name of [
      "What the issue says",
      "Evidence and verification status",
      "Timeline",
      "Demand versus decision",
      "Step 0: validate before building",
      "Problem framing and hypotheses",
      "Options",
      "Proposed requirements",
      "Concept mocks",
      "What the triage board said, and what it cannot see",
      "Success metrics, risks, open questions",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(/not affiliated with NetBird/i);
    expect(note).toHaveTextContent(/not.*reviewed or measured/i);
    expect(note).toHaveTextContent(/usernames are not shown/i);
  });

  it("labels every claim by who made it and whether it is verified, and keeps unknowns visible", async () => {
    render(await Case412());
    const evidence = screen.getByRole("heading", { level: 2, name: "Evidence and verification status" }).closest("section")!;
    expect(within(evidence).getAllByText(/^Verified/).length).toBeGreaterThanOrEqual(5);
    expect(within(evidence).getAllByText("Unknown")).toHaveLength(2);
    expect(within(evidence).getByText("Stated in a comment")).toBeInTheDocument();
    expect(within(evidence).getByText("Reported, not measured")).toBeInTheDocument();
  });

  it("separates verified timeline facts from what a commenter said", async () => {
    render(await Case412());
    const timeline = screen.getByRole("heading", { level: 2, name: "Timeline" }).closest("section")!;
    const items = within(timeline).getAllByRole("listitem");
    expect(items).toHaveLength(10);
    expect(within(timeline).getAllByText("Verified")).toHaveLength(9);
    expect(within(timeline).getAllByText("Stated in a comment")).toHaveLength(1);
    // Dates are real <time> elements.
    expect(timeline.querySelectorAll("time[datetime]")).toHaveLength(10);
  });

  it("marks the conclusion as a hypothesis and offers a recommendation with options", async () => {
    render(await Case412());
    expect(screen.getByText(/Hypothesis, not fact/)).toBeInTheDocument();
    const options = screen.getByRole("heading", { level: 2, name: "Options" }).closest("section")!;
    expect(within(options).getAllByText(/^[A-E]$/)).toHaveLength(5);
    expect(within(options).getByText("Recommended target")).toBeInTheDocument();
    expect(within(options).getByText(/run Step 0 now/i)).toBeInTheDocument();
  });

  it("lists eight requirements and embeds both concept mocks", async () => {
    render(await Case412());
    const reqs = screen.getByRole("heading", { level: 2, name: "Proposed requirements" }).closest("section")!;
    expect(within(reqs).getAllByText(/^R[1-8]$/)).toHaveLength(8);
    expect(screen.getByRole("group", { name: /Concept mock of a theme control/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Text gray level/)).toBeInTheDocument();
  });

  it("shows the triage board's draft scores and what they cannot see", async () => {
    render(await Case412());
    const lab = screen.getByRole("heading", { level: 2, name: /What the triage board said/ }).closest("section")!;
    expect(within(lab).getByText("impact")).toBeInTheDocument();
    expect(within(lab).getByText("urgency")).toBeInTheDocument();
    expect(within(lab).getByText(/The 29 reactions/)).toBeInTheDocument();
    expect(within(lab).getByRole("link", { name: /Open this issue on the triage board/ })).toHaveAttribute("href", "/?issue=dashboard-412");
  });

  it("loads the discussion panel for the issue, and degrades gracefully without the issue", async () => {
    render(await Case412());
    expect(screen.getByRole("button", { name: "Load the discussion" })).toBeInTheDocument();

    document.body.innerHTML = "";
    mockedGetIssue.mockResolvedValue(null);
    render(await Case412());
    expect(screen.queryByRole("button", { name: "Load the discussion" })).not.toBeInTheDocument();
    expect(screen.getByText(/The issue could not be loaded, so no scores were generated/)).toBeInTheDocument();
  });

  it("links back to the first case study", async () => {
    render(await Case412());
    expect(screen.getByRole("link", { name: /Case study 1/ })).toHaveAttribute("href", "/case-study/5513");
  });
});
