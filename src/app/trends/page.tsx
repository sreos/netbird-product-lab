import type { Metadata } from "next";
import { DataStatusBanner } from "@/components/DataStatusBanner";
import { TrendsView } from "@/components/TrendsView";
import { getIssueFeed } from "@/lib/github";
import { toTrendRow } from "@/lib/trends";

export const metadata: Metadata = {
  title: "Trends",
  description: "How the loaded NetBird issues are distributed over time and by category, with the limits of that data stated.",
};

// Same cache window as the other pages (see src/app/page.tsx). Must be a literal for Next.
export const revalidate = 900;

export default async function TrendsPage() {
  const feed = await getIssueFeed();
  const rows = feed.issues.map(toTrendRow);

  return (
    <div className="space-y-6">
      <section aria-labelledby="trends-h" className="max-w-3xl space-y-3">
        <h1 id="trends-h" className="text-3xl font-bold tracking-tight text-ink">
          Backlog trends
        </h1>
        <p className="text-muted">
          How the open issues in <span className="font-mono text-sm text-ink">netbirdio/netbird</span> and{" "}
          <span className="font-mono text-sm text-ink">netbirdio/dashboard</span> are spread over time and across categories.
        </p>
      </section>

      <div role="note" className="max-w-3xl rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
        <strong className="text-ink">Read this before drawing conclusions.</strong> Only the most recently <em>updated</em> open
        items per repository are loaded, so older issues appear only if they are still active. The charts therefore show what is in
        the backlog <em>today</em> and when those issues were opened. They are <strong className="text-ink">not</strong> a complete
        history of what was reported, and a quiet month does not mean fewer reports. Closed issues are not included.
      </div>

      <DataStatusBanner feed={feed} />
      <TrendsView rows={rows} nowIso={feed.fetchedAt} />
    </div>
  );
}
