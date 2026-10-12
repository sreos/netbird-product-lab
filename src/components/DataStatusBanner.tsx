import { formatDateTime } from "@/lib/text";
import type { IssueFeed } from "@/lib/types";

export function DataStatusBanner({ feed }: { feed: IssueFeed }) {
  const fallbacks = feed.repos.filter((r) => r.source === "sample");

  if (fallbacks.length === 0) {
    return (
      <p
        role="status"
        className="flex flex-wrap items-center gap-x-2 rounded-lg border border-line bg-ok-soft px-4 py-2.5 text-sm text-ok"
      >
        <span aria-hidden="true">●</span>
        <span>
          <strong>Live data</strong> from the public GitHub API, cached up to 15 minutes. Last refreshed{" "}
          {formatDateTime(feed.fetchedAt)}.
        </span>
      </p>
    );
  }

  return (
    <div role="status" className="rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
      <p className="font-semibold">
        <span aria-hidden="true">▲ </span>
        Showing a sample snapshot from {feed.sampleSnapshotDate} for {fallbacks.length === feed.repos.length ? "all repositories" : fallbacks.map((r) => r.repo).join(", ")}.
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {fallbacks.map((r) => (
          <li key={r.repo}>
            <span className="font-mono text-xs">{r.repo}</span>: {r.reason ?? "live data unavailable"}.
          </li>
        ))}
      </ul>
      <p className="mt-1">
        The sample contains real public issues, so every feature still works, but counts and dates may be out of date.
        {feed.repos.some((r) => r.source === "live") ? " Other repositories are live." : ""}
      </p>
    </div>
  );
}
