// Issue text comes from arbitrary GitHub users. We treat it as untrusted: it is cleaned for
// readability here and rendered as plain text by React (which escapes it), never as HTML.

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
// Only strip tags that are common layout noise in issue templates; keep things like <KEY> placeholders.
const NOISY_TAG =
  /<\/?(?:img|br|hr|details|summary|p|div|span|picture|source|center|sub|sup|b|i|em|strong|a|table|thead|tbody|tr|td|th)\b[^>]*>/gi;

const HEADING_LINE = /^\s*(?:#{1,6}\s+.*|\*\*[^*\n]+\*\*:?|__[^_\n]+__:?)\s*$/;

export function cleanBody(raw: string | null | undefined, max = 4000): { text: string; truncated: boolean } {
  if (!raw) return { text: "", truncated: false };
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(HTML_COMMENT, "")
    .replace(MARKDOWN_IMAGE, "[image]")
    .replace(NOISY_TAG, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length <= max) return { text, truncated: false };
  return { text: cutAtWord(text, max), truncated: true };
}

/** Truncate at a word boundary and add an ellipsis. */
export function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const base = lastSpace > max * 0.7 ? slice.slice(0, lastSpace) : slice;
  return `${base.trimEnd()}…`;
}

/**
 * First meaningful prose from an issue body, skipping template headings such as
 * "**Describe the problem**". Used for the ticket's problem statement.
 */
export function summarizeBody(text: string, max = 320): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) =>
      p
        .split("\n")
        .filter((line) => !HEADING_LINE.test(line))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  let out = "";
  for (const p of paragraphs) {
    out = out ? `${out} ${p}` : p;
    if (out.length >= max * 0.6) break;
  }
  return cutAtWord(out, max);
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

/** Fixed-timezone formatting so server and client render identical text (no hydration mismatch). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "unknown date" : DATE_FORMAT.format(d);
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "unknown time" : `${DATE_TIME_FORMAT.format(d)} UTC`;
}
