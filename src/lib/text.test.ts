import { describe, expect, it } from "vitest";
import { normalizeIssue } from "./normalize";
import { cleanBody, summarizeBody } from "./text";

describe("cleanBody", () => {
  it("removes HTML comments, images, and layout tags but keeps placeholders like <KEY>", () => {
    const { text } = cleanBody("Hi<!-- hidden -->\r\n\r\n\r\n\r\n![shot](https://x/y.png)<br>run `netbird up --setup-key <KEY>`");
    expect(text).not.toContain("hidden");
    expect(text).not.toContain("https://x/y.png");
    expect(text).not.toContain("<br>");
    expect(text).toContain("<KEY>");
    expect(text).not.toMatch(/\n{3,}/);
  });

  it("truncates at a word boundary and flags it", () => {
    const { text, truncated } = cleanBody("word ".repeat(100), 50);
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(51);
    expect(text.endsWith("…")).toBe(true);
  });

  it("handles empty input", () => {
    expect(cleanBody(null)).toEqual({ text: "", truncated: false });
  });
});

describe("summarizeBody", () => {
  it("skips template headings and returns the first prose", () => {
    const body = "**Describe the problem**\n\nThe client stays connected but peers fail.\n\n**To Reproduce**\n\n1. step";
    expect(summarizeBody(body)).toMatch(/^The client stays connected/);
  });

  it("returns an empty string when there is only headings", () => {
    expect(summarizeBody("**Heading**\n\n## Another")).toBe("");
  });
});

describe("normalizeIssue", () => {
  const raw = {
    number: 7,
    title: "  A title  ",
    labels: [{ name: "bug" }, { name: null }, "plain"],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    comments: 2,
    body: "text",
  };

  it("builds the URL itself instead of trusting the payload", () => {
    const issue = normalizeIssue({ ...raw, html_url: "javascript:alert(1)" } as never, "netbirdio/netbird");
    expect(issue?.url).toBe("https://github.com/netbirdio/netbird/issues/7");
    expect(issue?.title).toBe("A title");
    expect(issue?.labels).toEqual(["bug", "plain"]);
  });

  it("drops pull requests and malformed entries", () => {
    expect(normalizeIssue({ ...raw, pull_request: {} }, "netbirdio/netbird")).toBeNull();
    expect(normalizeIssue({ ...raw, created_at: "nope" }, "netbirdio/netbird")).toBeNull();
    expect(normalizeIssue({ ...raw, title: undefined } as never, "netbirdio/netbird")).toBeNull();
  });
});
