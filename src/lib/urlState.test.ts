import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW, issueKey, parseIssueKey, parseView, serializeView } from "./urlState";

describe("issue keys", () => {
  it("round-trips an issue id through its URL-friendly key", () => {
    expect(issueKey("netbirdio/netbird#5513")).toBe("netbird-5513");
    expect(issueKey("netbirdio/dashboard#412")).toBe("dashboard-412");
    expect(parseIssueKey("netbird-5513")).toBe("netbirdio/netbird#5513");
    expect(parseIssueKey("dashboard-412")).toBe("netbirdio/dashboard#412");
  });

  it("rejects repositories we do not load and malformed keys", () => {
    for (const bad of ["other-1", "netbird-", "netbird-abc", "netbird-5513x", "../netbird-1", "", "netbird-99999999999"]) {
      expect(parseIssueKey(bad)).toBeNull();
    }
  });
});

describe("parseView", () => {
  it("returns the defaults for an empty query string", () => {
    expect(parseView("")).toEqual(DEFAULT_VIEW);
  });

  it("reads every supported parameter", () => {
    expect(parseView("?q=sso&repo=dashboard&cat=ux&sort=updated&issue=netbird-5513&theme=netbird-2860")).toEqual({
      query: "sso",
      repo: "netbirdio/dashboard",
      category: "ux",
      sort: "updated",
      issueId: "netbirdio/netbird#5513",
      themeId: "netbirdio/netbird#2860",
    });
  });

  it("ignores a malformed theme parameter", () => {
    expect(parseView("?theme=../../x").themeId).toBeNull();
    expect(parseView("?theme=other-1").themeId).toBeNull();
  });

  it("accepts the 'uncategorized' filter", () => {
    expect(parseView("?cat=uncategorized").category).toBe("uncategorized");
  });

  it("falls back to defaults for unknown or hostile values", () => {
    const view = parseView("?repo=evil&cat=<script>&sort=drop table&issue=javascript:alert(1)");
    expect(view).toEqual(DEFAULT_VIEW);
  });

  it("caps the length of the search text", () => {
    expect(parseView(`?q=${"a".repeat(5000)}`).query).toHaveLength(200);
  });
});

describe("serializeView", () => {
  it("omits defaults, so the default view has a clean URL", () => {
    expect(serializeView(DEFAULT_VIEW)).toBe("");
    expect(serializeView({ ...DEFAULT_VIEW, query: "   " })).toBe("");
  });

  it("round-trips a full view", () => {
    const view = {
      query: "token expiry",
      repo: "netbirdio/netbird" as const,
      category: "reliability" as const,
      sort: "comments" as const,
      issueId: "netbirdio/netbird#5513",
      themeId: "netbirdio/netbird#2860",
    };
    expect(serializeView(view)).toBe(
      "?q=token+expiry&repo=netbird&cat=reliability&sort=comments&theme=netbird-2860&issue=netbird-5513",
    );
    expect(parseView(serializeView(view))).toEqual(view);
  });
});
