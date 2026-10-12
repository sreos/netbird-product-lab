import { describe, expect, it } from "vitest";
import { normalizeComment, summarizeDiscussion, type IssueComment } from "./comments";

const raw = (over: Record<string, unknown> = {}) => ({
  id: 1001,
  body: "Thanks for raising this.",
  created_at: "2026-10-12T11:00:22Z",
  author_association: "COLLABORATOR",
  user: { type: "User", login: "someone-private" },
  ...over,
});

describe("normalizeComment", () => {
  it("keeps the role, date, and a link, and flags project team members", () => {
    const c = normalizeComment(raw(), "netbirdio/netbird", 5513)!;
    expect(c).toMatchObject({ id: 1001, association: "collaborator", team: true, bot: false });
    expect(c.url).toBe("https://github.com/netbirdio/netbird/issues/5513#issuecomment-1001");
    expect(c.createdAt).toBe("2026-10-12T11:00:22Z");
  });

  it("never carries the commenter's username or any other user field", () => {
    const c = normalizeComment(raw(), "netbirdio/netbird", 1)!;
    expect(JSON.stringify(c)).not.toContain("someone-private");
    expect(Object.keys(c).sort()).toEqual(["association", "body", "bodyTruncated", "bot", "createdAt", "id", "team", "url"]);
  });

  it("maps GitHub's association values, treating owner, member, and collaborator as the team", () => {
    const team = (a: string) => normalizeComment(raw({ author_association: a }), "netbirdio/netbird", 1)!.team;
    expect(team("OWNER")).toBe(true);
    expect(team("MEMBER")).toBe(true);
    expect(team("COLLABORATOR")).toBe(true);
    expect(team("CONTRIBUTOR")).toBe(false);
    expect(team("NONE")).toBe(false);
    expect(team("FIRST_TIME_CONTRIBUTOR")).toBe(false);
  });

  it("falls back to 'none' for unknown or missing associations", () => {
    expect(normalizeComment(raw({ author_association: "SOMETHING_NEW" }), "netbirdio/netbird", 1)!.association).toBe("none");
    expect(normalizeComment(raw({ author_association: undefined }), "netbirdio/netbird", 1)!.association).toBe("none");
  });

  it("flags bots", () => {
    expect(normalizeComment(raw({ user: { type: "Bot" } }), "netbirdio/netbird", 1)!.bot).toBe(true);
  });

  it("cleans and limits the text", () => {
    const c = normalizeComment(raw({ body: `<!-- hidden -->hello ${"word ".repeat(600)}` }), "netbirdio/netbird", 1)!;
    expect(c.body).not.toContain("hidden");
    expect(c.bodyTruncated).toBe(true);
    expect(c.body.length).toBeLessThanOrEqual(1501);
  });

  it("rejects malformed entries", () => {
    expect(normalizeComment(raw({ id: "x" }), "netbirdio/netbird", 1)).toBeNull();
    expect(normalizeComment(raw({ created_at: "nope" }), "netbirdio/netbird", 1)).toBeNull();
    expect(normalizeComment(null as never, "netbirdio/netbird", 1)).toBeNull();
  });
});

describe("summarizeDiscussion", () => {
  const c = (over: Partial<IssueComment>): IssueComment => ({
    id: 1,
    association: "none",
    team: false,
    bot: false,
    createdAt: "2026-03-09T12:00:00Z",
    url: "u",
    body: "",
    bodyTruncated: false,
    ...over,
  });

  it("counts team comments, finds the first team response, and the latest comment", () => {
    const s = summarizeDiscussion([
      c({ id: 1, createdAt: "2026-03-09T12:00:00Z" }),
      c({ id: 2, team: true, association: "collaborator", createdAt: "2026-10-12T11:00:00Z" }),
      c({ id: 3, team: true, association: "member", createdAt: "2026-05-01T09:00:00Z" }),
    ]);
    expect(s).toEqual({
      loaded: 3,
      teamComments: 2,
      firstTeamResponseAt: "2026-05-01T09:00:00.000Z",
      lastCommentAt: "2026-10-12T11:00:00.000Z",
    });
  });

  it("does not count a bot as a team response, even if GitHub files it under the team", () => {
    const s = summarizeDiscussion([c({ team: true, bot: true, association: "member" })]);
    expect(s.teamComments).toBe(0);
    expect(s.firstTeamResponseAt).toBeNull();
  });

  it("handles an empty thread", () => {
    expect(summarizeDiscussion([])).toEqual({ loaded: 0, teamComments: 0, firstTeamResponseAt: null, lastCommentAt: null });
  });
});
