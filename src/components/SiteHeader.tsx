import Link from "next/link";
import { NavLinks } from "./NavLinks";

function BrandMark() {
  // Generic "triage graph" glyph. Deliberately not NetBird's logo.
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="shrink-0">
      <rect width="28" height="28" rx="7" fill="var(--accent)" />
      <circle cx="9" cy="9" r="2.6" fill="var(--accent-ink)" />
      <circle cx="19" cy="9" r="2.6" fill="var(--accent-ink)" />
      <circle cx="14" cy="19" r="2.6" fill="var(--accent-ink)" />
      <path d="M9 9h10M9 9l5 10M19 9l-5 10" stroke="var(--accent-ink)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header>
      <p className="border-b border-line bg-surface-2 px-4 py-2 text-center text-xs text-muted sm:text-sm">
        <strong className="font-semibold text-ink">Independent portfolio prototype.</strong> Not affiliated with, endorsed by,
        or sponsored by NetBird.
      </p>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-ink">
            <BrandMark />
            <span>NetBird Product Lab</span>
          </Link>
          <NavLinks />
        </div>
      </div>
    </header>
  );
}
