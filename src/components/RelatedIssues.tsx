import type { RelatedMatch, Theme } from "@/lib/similarity";
import type { Issue } from "@/lib/types";

interface Props {
  matches: RelatedMatch[];
  theme: Theme | undefined;
  activeThemeId: string | null;
  lookup: (issueId: string) => Issue | undefined;
  onSelect: (issueId: string) => void;
  onShowTheme: (themeId: string) => void;
}

const CLOSER_MATCH = 0.25;

export function RelatedIssues({ matches, theme, activeThemeId, lookup, onSelect, onShowTheme }: Props) {
  return (
    <section aria-labelledby="related-h" className="space-y-2">
      <h3 id="related-h" className="text-base font-semibold text-ink">
        Possibly related issues
      </h3>
      <p className="text-xs text-muted">
        Found by <strong className="text-ink">shared wording only</strong>, not meaning. It can miss a duplicate that is phrased
        differently and can link unrelated issues that share jargon. Never treat these as confirmed duplicates.
      </p>

      {theme && (
        <p className="text-sm text-ink">
          Possible theme: <span className="font-semibold">{theme.label}</span> ({theme.issueIds.length} issues){" "}
          {activeThemeId === theme.id ? (
            <span className="text-muted">Showing this theme in the list.</span>
          ) : (
            <button
              type="button"
              onClick={() => onShowTheme(theme.id)}
              className="font-medium text-accent underline underline-offset-2"
            >
              Show only this theme
            </button>
          )}
        </p>
      )}

      {matches.length === 0 ? (
        <p className="text-sm text-muted">
          No other loaded issue shares enough distinctive wording with this one. That does not mean none exists.
        </p>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => {
            const other = lookup(m.id);
            if (!other) return null;
            return (
              <li key={m.id} className="rounded-lg border border-line bg-surface p-3 text-sm">
                <button type="button" onClick={() => onSelect(m.id)} className="text-left font-medium text-ink hover:underline">
                  {other.title}
                </button>
                <p className="mt-1 text-xs text-muted">
                  <span className="font-mono">
                    {other.repo.split("/")[1]}#{other.number}
                  </span>
                  {" · "}
                  {m.score >= CLOSER_MATCH ? "Closer match" : "Looser match"}
                  {" · "}shared words: <span className="text-ink">{m.shared.join(", ")}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
