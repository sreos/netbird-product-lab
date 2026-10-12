"use client";

import { useId, useState } from "react";

type Variant = "reported" | "interim" | "proposed";
type Choice = "light" | "dark" | "system";
type Mode = "light" | "dark";

/** Colors of the two preview themes. They are illustrative, and tests check that they meet WCAG AA. */
export const PREVIEW_THEMES: Record<Mode, { bg: string; surface: string; text: string; muted: string; accent: string; accentText: string; border: string }> = {
  light: { bg: "#ffffff", surface: "#f3f4f6", text: "#1f2937", muted: "#4b5563", accent: "#2443bd", accentText: "#ffffff", border: "#d1d5db" },
  dark: { bg: "#12161c", surface: "#1c222b", text: "#e5e7eb", muted: "#a3afbf", accent: "#8fb0ff", accentText: "#0d1117", border: "#2b3542" },
};

const VARIANTS: Array<{ id: Variant; tab: string; rationale: string[] }> = [
  {
    id: "reported",
    tab: "1. As reported",
    rationale: [
      "The reporter describes a theme control in the top right where Light and System are visible but disabled, with nothing explaining why.",
      "A control that shows options which do nothing promises something it does not deliver. It invites exactly the “is this coming?” comments seen in the thread.",
      "This is drawn from the issue text. It is not a recording of the real dashboard.",
    ],
  },
  {
    id: "interim",
    tab: "2. Interim: say so",
    rationale: [
      "If the feature cannot ship soon, say so where people look: “not available yet”, with a link to where progress is tracked.",
      "It costs almost nothing, and gives every future visitor an answer that does not need a new comment.",
      "It is not a substitute for a decision (see Step 0), only a way to stop the silence from costing trust.",
    ],
  },
  {
    id: "proposed",
    tab: "3. Proposed",
    rationale: [
      "Light, Dark, and System all work, and the choice is remembered in the browser (R1).",
      "System follows the device and updates when the device setting changes (R4). Try the checkbox to simulate that.",
      "The page must not flash the wrong theme while loading (R3), and both themes must meet the contrast targets (R2).",
    ],
  },
];

export function ThemeControlMock() {
  const [variant, setVariant] = useState<Variant>("reported");
  const [choice, setChoice] = useState<Choice>("dark");
  const [deviceLight, setDeviceLight] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const uid = useId();

  const proposed = variant === "proposed";
  const effectiveChoice: Choice = proposed ? choice : "dark";
  const mode: Mode = effectiveChoice === "system" ? (deviceLight ? "light" : "dark") : effectiveChoice;
  const t = PREVIEW_THEMES[mode];
  const current = VARIANTS.find((v) => v.id === variant)!;

  const options: Array<{ id: Choice; label: string }> = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "system", label: proposed ? `System (device: ${deviceLight ? "light" : "dark"})` : "System" },
  ];

  function pick(next: Choice) {
    setChoice(next);
    const resolved = next === "system" ? (deviceLight ? "light" : "dark") : next;
    setAnnouncement(`Theme set to ${next === "system" ? `System, which is currently ${resolved}` : next}.`);
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Choose a version to preview</legend>
        <div className="flex flex-wrap gap-2">
          {VARIANTS.map((v) => {
            const id = `${uid}-${v.id}`;
            const checked = v.id === variant;
            return (
              <div key={v.id}>
                <input
                  id={id}
                  type="radio"
                  name={`${uid}-variant`}
                  checked={checked}
                  onChange={() => setVariant(v.id)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={id}
                  className={`block cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                    checked ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink hover:bg-surface-2"
                  }`}
                >
                  {v.tab}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div role="group" aria-label="Concept mock of a theme control and a preview" className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted">
            <span className="font-semibold uppercase tracking-wide">Concept mock · not the real dashboard</span>
            <span>{proposed ? "Proposed" : variant === "interim" ? "Interim" : "As reported"}</span>
          </div>

          <div className="space-y-4 p-4">
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-ink">Theme</legend>
              <div className="flex flex-wrap gap-2">
                {options.map((o) => {
                  const enabled = proposed || o.id === "dark";
                  const id = `${uid}-theme-${o.id}`;
                  const selected = effectiveChoice === o.id;
                  return (
                    <div key={o.id}>
                      <input
                        id={id}
                        type="radio"
                        name={`${uid}-theme`}
                        checked={selected}
                        disabled={!enabled}
                        onChange={() => pick(o.id)}
                        className="peer sr-only"
                      />
                      <label
                        htmlFor={id}
                        className={`block rounded-lg border px-3 py-1.5 text-sm font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                          !enabled
                            ? "cursor-not-allowed border-dashed border-line bg-surface-2 text-muted opacity-60"
                            : selected
                              ? "cursor-pointer border-accent bg-accent text-accent-ink"
                              : "cursor-pointer border-line bg-surface text-ink hover:bg-surface-2"
                        }`}
                      >
                        {o.label}
                      </label>
                    </div>
                  );
                })}
              </div>
              {variant === "interim" && (
                <p className="mt-2 text-sm text-ink">
                  Light and System are not available yet.{" "}
                  <a
                    href="https://github.com/netbirdio/dashboard/pull/658"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-accent underline underline-offset-2"
                  >
                    Follow progress on GitHub<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  .
                </p>
              )}
              {proposed && (
                <label className="mt-3 flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={deviceLight} onChange={(e) => setDeviceLight(e.target.checked)} className="h-4 w-4" />
                  Pretend my device is set to light mode
                </label>
              )}
            </fieldset>

            {/* Preview of an illustrative screen in the chosen theme */}
            <div
              data-testid="theme-preview"
              data-mode={mode}
              className="rounded-lg p-4"
              style={{ backgroundColor: t.bg, color: t.text, border: `1px solid ${t.border}` }}
            >
              <p className="text-base font-semibold">Peers</p>
              <p className="text-sm" style={{ color: t.muted }}>
                Preview of an illustrative screen in the {mode} theme
              </p>
              <ul className="mt-3 space-y-2">
                {[
                  ["build-runner-01", "Connected"],
                  ["db-server", "Connected"],
                  ["laptop-ana", "Offline"],
                ].map(([name, status]) => (
                  <li key={name} className="flex items-center justify-between rounded-md px-3 py-2 text-sm" style={{ backgroundColor: t.surface }}>
                    <span className="font-mono">{name}</span>
                    <span style={{ color: t.muted }}>{status}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-3 inline-block rounded-md px-3 py-1.5 text-sm font-semibold" style={{ backgroundColor: t.accent, color: t.accentText }}>
                Add peer
              </span>
            </div>
            <p role="status" aria-live="polite" className="sr-only">
              {announcement}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 lg:self-start">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Design rationale</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-ink">
            {current.rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
