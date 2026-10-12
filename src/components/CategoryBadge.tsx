import { CATEGORY_LABELS, type Category, type CategoryBasis } from "@/lib/categorize";

const TONE: Record<Category, string> = {
  bug: "bg-danger-soft text-danger",
  reliability: "bg-warn-soft text-warn",
  ux: "bg-accent-soft text-accent",
  documentation: "bg-ok-soft text-ok",
  "feature-request": "bg-violet-soft text-violet",
};

/**
 * Solid badge  = decided from a GitHub label.
 * Dashed badge = inferred from wording (a suggestion). The distinction is also in the text for screen readers.
 */
export function CategoryBadge({ category, basis }: { category: Category; basis: CategoryBasis }) {
  const inferred = basis === "keyword";
  return (
    <span
      className={`badge-outline inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[category]} ${
        inferred ? "border border-dashed border-current" : "border border-transparent"
      }`}
    >
      {CATEGORY_LABELS[category]}
      <span className="sr-only">{inferred ? " (inferred from wording)" : " (from a GitHub label)"}</span>
    </span>
  );
}

export function GitHubLabel({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
      {name}
    </span>
  );
}
