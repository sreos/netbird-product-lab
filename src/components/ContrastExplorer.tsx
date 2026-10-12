"use client";

import { useId, useState } from "react";
import { grayHex, judgeContrast, WCAG_AA } from "@/lib/contrast";

const PRESETS = [
  { label: "Mid gray on near-black", text: 118, bg: 18 },
  { label: "Lighter gray on near-black", text: 160, bg: 18 },
  { label: "The same mid gray on white", text: 118, bg: 255 },
] as const;

function Verdict({ ok, label, threshold }: { ok: boolean; label: string; threshold: number }) {
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}
    >
      <span className="text-ink">
        {label} <span className="text-muted">(needs {threshold}:1)</span>
      </span>
      <span className="font-semibold">
        <span aria-hidden="true">{ok ? "✓ " : "✕ "}</span>
        {ok ? "Passes" : "Fails"}
      </span>
    </li>
  );
}

/**
 * Turns "gray on black is hard to read" into a number. Colors are neutral grays chosen by the reader and
 * are illustrative: this does not measure any real product.
 */
export function ContrastExplorer() {
  const [text, setText] = useState<number>(PRESETS[0].text);
  const [bg, setBg] = useState<number>(PRESETS[0].bg);
  const uid = useId();

  const fg = grayHex(text);
  const back = grayHex(bg);
  const verdict = judgeContrast(fg, back)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Examples">
        {PRESETS.map((p) => {
          const active = p.text === text && p.bg === bg;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setText(p.text);
                setBg(p.bg);
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                active ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink hover:bg-surface-2"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
          <div>
            <label htmlFor={`${uid}-text`} className="flex justify-between text-sm font-semibold text-ink">
              <span>Text gray level</span>
              <span className="font-mono font-normal text-muted">{fg}</span>
            </label>
            <input id={`${uid}-text`} type="range" min={0} max={255} value={text} onChange={(e) => setText(Number(e.target.value))} className="mt-1 w-full" />
          </div>
          <div>
            <label htmlFor={`${uid}-bg`} className="flex justify-between text-sm font-semibold text-ink">
              <span>Background gray level</span>
              <span className="font-mono font-normal text-muted">{back}</span>
            </label>
            <input id={`${uid}-bg`} type="range" min={0} max={255} value={bg} onChange={(e) => setBg(Number(e.target.value))} className="mt-1 w-full" />
          </div>

          {/* A specimen, not content: it deliberately shows whatever contrast the sliders produce, including
              failing ones, so it is drawn as an image. The verdict beside it carries the information in text. */}
          <svg
            role="img"
            aria-label="Specimen: normal-size and large text in the chosen colors. The results are listed beside it."
            viewBox="0 0 380 112"
            className="block w-full rounded-lg"
            style={{ border: "1px solid var(--line)" }}
            data-testid="contrast-sample"
          >
            <rect width="380" height="112" fill={back} />
            <text x="16" y="36" fontSize="14" fill={fg} fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif">
              Normal text: peers, networks, policies.
            </text>
            <text x="16" y="82" fontSize="28" fontWeight="700" fill={fg} fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif">
              Large text
            </text>
          </svg>
        </div>

        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Contrast ratio</p>
          <p className="text-4xl font-semibold leading-none text-ink" role="status" aria-live="polite">
            {verdict.ratio.toFixed(2)}:1
          </p>
          <ul className="space-y-2" aria-label="WCAG 2.2 AA results">
            <Verdict ok={verdict.normalText} label="Normal text" threshold={WCAG_AA.normalText} />
            <Verdict ok={verdict.largeText} label="Large text and UI parts" threshold={WCAG_AA.largeText} />
          </ul>
          <p className="text-xs text-muted">
            WCAG 2.2 success criterion 1.4.3 (Contrast, Minimum). Large text means 24px, or 18.66px and bold, and up. These grays are
            illustrative; NetBird&rsquo;s real dashboard colors were <strong className="text-ink">not measured</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
