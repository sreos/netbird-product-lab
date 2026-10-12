export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading issues from GitHub…</span>
      <div aria-hidden="true" className="space-y-3">
        <div className="h-9 w-3/4 max-w-xl animate-pulse rounded-lg bg-surface-2" />
        <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-surface-2" />
      </div>
      <div aria-hidden="true" className="h-28 animate-pulse rounded-xl border border-line bg-surface" />
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-[5fr_6fr]">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-surface" />
          ))}
        </div>
        <div className="hidden h-[32rem] animate-pulse rounded-xl border border-line bg-surface lg:block" />
      </div>
    </div>
  );
}
