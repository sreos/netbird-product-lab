import { summarizeDiscussion, type CommentsErrorKind, type CommentsErrorResponse, type CommentsResponse } from "@/lib/comments";
import { fetchIssueComments, getIssueFeed, GitHubError } from "@/lib/github";
import type { RepoSlug } from "@/lib/types";
import { parseIssueKey } from "@/lib/urlState";

// Read-only: one GET to GitHub's public API per request, made on the server so the optional token
// never reaches the browser. Responses are cached at the edge for 15 minutes.
const CACHE_HEADER = "public, s-maxage=900, stale-while-revalidate=3600";

function fail(kind: CommentsErrorKind, message: string, status: number): Response {
  const body: CommentsErrorResponse = { error: { kind, message } };
  // Errors must not be cached, or one rate-limited moment would stick for 15 minutes.
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * GET /api/comments?issue=netbird-5513
 *
 * Only issues that are part of the loaded data can be requested. That keeps this endpoint from being
 * used to enumerate arbitrary issue numbers and burn the shared GitHub rate limit.
 */
export async function GET(request: Request): Promise<Response> {
  const key = new URL(request.url).searchParams.get("issue") ?? "";
  const issueId = parseIssueKey(key);
  if (!issueId) return fail("bad_request", "Missing or invalid issue parameter.", 400);

  if (process.env.USE_SAMPLE_DATA === "1") {
    return fail("sample_mode", "Sample mode is enabled, so comments are not loaded from GitHub.", 503);
  }

  const feed = await getIssueFeed();
  const issue = feed.issues.find((i) => i.id === issueId);
  if (!issue) return fail("not_found", "That issue is not part of the loaded data.", 404);

  const repo = issue.repo as RepoSlug;
  try {
    const comments = await fetchIssueComments(repo, issue.number);
    const body: CommentsResponse = {
      issue: issueId,
      total: issue.comments,
      comments,
      summary: summarizeDiscussion(comments),
      fetchedAt: new Date().toISOString(),
    };
    return Response.json(body, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch (error) {
    if (error instanceof GitHubError) {
      return fail(error.kind, error.message, error.kind === "rate_limit" ? 429 : 502);
    }
    return fail("http", "Unexpected error while loading comments.", 500);
  }
}
