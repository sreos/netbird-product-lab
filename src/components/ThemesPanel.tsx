"use client";

import { useEffect, useState } from "react";
import type { Theme } from "@/lib/similarity";

interface Props {
  themes: Theme[];
  activeId: string | null;
  onToggle: (themeId: string) => void;
}

export function ThemesPanel({ themes, activeId, onToggle }: Props) {
  const [open, setOpen] = useState(false);

  // A theme restored from a shared link should be visible, not hidden in a closed panel.
  useEffect(() => {
    if (activeId) setOpen(true);
  }, [activeId]);

  if (themes.length === 0) return null;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-xl border border-line bg-surface p-4"
    >
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        Possible themes <span className="font-normal text-muted">({themes.length})</span>
      </summary>
      <p className="mt-2 text-xs text-muted">
        Issues grouped by <strong className="text-ink">shared wording</strong>, not by meaning. A theme can miss issues phrased
        differently or group unrelated ones that share jargon, so read the issues before treating them as one problem. Choose a
        theme to filter the list to its issues.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Themes">
        {themes.map((theme) => {
          const active = theme.id === activeId;
          return (
            <li key={theme.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(theme.id)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  active ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                {theme.label} <span className={active ? "font-normal" : "text-muted"}>{theme.issueIds.length}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
