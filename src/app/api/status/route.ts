import { getRateLimitStatus, GitHubError } from "@/lib/github";

// A tiny, public, read-only health readout. It reveals only whether a token is set, whether GitHub accepts
// it, and the current rate limit: never the token itself. It exists so that adding GITHUB_TOKEN can be
// verified (the limit changes from 60 to 5,000 per hour) instead of assumed.
const CACHE_HEADER = "public, s-maxage=30";

export async function GET(): Promise<Response> {
  const tokenConfigured = Boolean(process.env.GITHUB_TOKEN?.trim());

  if (process.env.USE_SAMPLE_DATA === "1") {
    return Response.json({ sampleMode: true, tokenConfigured, github: null }, { headers: { "Cache-Control": CACHE_HEADER } });
  }

  try {
    const github = await getRateLimitStatus();
    return Response.json({ sampleMode: false, tokenConfigured, github }, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch (error) {
    const message = error instanceof GitHubError ? error.message : "Unexpected error while reading the GitHub rate limit.";
    return Response.json(
      { sampleMode: false, tokenConfigured, github: null, error: { message } },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
