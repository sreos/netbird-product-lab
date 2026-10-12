/**
 * WCAG 2.x contrast ratio, as defined in the spec (relative luminance of sRGB colors).
 * Used by the case-study contrast explorer to make "readable enough" a number instead of an opinion.
 */

export const WCAG_AA = {
  /** Success criterion 1.4.3: normal-size text. */
  normalText: 4.5,
  /** Success criterion 1.4.3: large text (24px, or 18.66px bold, and up). Also 1.4.11 for UI components. */
  largeText: 3,
} as const;

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colors (order does not matter), from 1 to 21. Null for invalid input. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** A neutral gray like #767676 from a 0 to 255 level. */
export function grayHex(level: number): string {
  const v = Math.min(255, Math.max(0, Math.round(level)));
  const h = v.toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
}

export interface ContrastVerdict {
  ratio: number;
  normalText: boolean;
  largeText: boolean;
}

export function judgeContrast(foreground: string, background: string): ContrastVerdict | null {
  const ratio = contrastRatio(foreground, background);
  if (ratio === null) return null;
  return { ratio, normalText: ratio >= WCAG_AA.normalText, largeText: ratio >= WCAG_AA.largeText };
}
