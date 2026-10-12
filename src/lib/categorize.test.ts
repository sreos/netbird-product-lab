import { describe, expect, it } from "vitest";
import { getSampleIssues } from "@/data/sample";
import { categorize } from "./categorize";

const issue = (title: string, labels: string[] = [], body = "") => ({ title, labels, body });

describe("categorize", () => {
  it("uses GitHub labels as the strongest signal", () => {
    const result = categorize(issue("Auth endpoint returns 404 on successful login", ["bug", "self-hosted"]));
    expect(result.primary).toBe("bug");
    expect(result.matches[0]).toMatchObject({ category: "bug", basis: "label", labels: ["bug"], keywords: [] });
  });

  it("matches labels case-insensitively (the repo really uses a 'UX' label)", () => {
    expect(categorize(issue("Unable to troubleshoot posture checks", ["UX", "agent"])).primary).toBe("ux");
  });

  it("infers a category from title wording and marks it as keyword-based", () => {
    const result = categorize(issue("Signal gRPC stream never retries after a WAN outage"));
    expect(result.primary).toBe("reliability");
    expect(result.matches[0].basis).toBe("keyword");
    expect(result.matches[0].labels).toEqual([]);
    expect(result.matches[0].keywords.join(" ")).toContain("in title");
  });

  it("keeps label facts and wording inferences separate when both apply", () => {
    const result = categorize(issue("Peer link is being dropped", ["connection"]));
    const reliability = result.matches.find((m) => m.category === "reliability")!;
    expect(reliability.basis).toBe("label");
    expect(reliability.labels).toEqual(["connection"]);
    expect(reliability.keywords.join(" ")).toContain("dropped");
  });

  it("ignores a single weak hint in the description", () => {
    expect(categorize(issue("Question about something", [], "There was an error once.")).primary).toBeNull();
  });

  it("recognizes unlabeled feature requests by phrasing", () => {
    expect(categorize(issue("Add a delete action to the peer detail page")).primary).toBe("feature-request");
  });

  it("can assign several categories to one issue", () => {
    const result = categorize(issue("Peer link is being dropped", ["bug", "client", "connection"]));
    expect(result.matches.map((m) => m.category)).toEqual(expect.arrayContaining(["bug", "reliability"]));
  });

  it("returns no category when there is no signal", () => {
    expect(categorize(issue("Hello", [], "")).primary).toBeNull();
  });

  it("categorizes the SSO expiry case study as reliability", () => {
    const sso = getSampleIssues("netbirdio/netbird").find((i) => i.number === 5513)!;
    expect(categorize(sso).primary).toBe("reliability");
  });

  it("covers all five categories across the bundled sample data", () => {
    const seen = new Set(getSampleIssues().flatMap((i) => categorize(i).matches.map((m) => m.category)));
    expect([...seen].sort()).toEqual(["bug", "documentation", "feature-request", "reliability", "ux"]);
  });
});
