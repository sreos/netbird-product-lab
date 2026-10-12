"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-xl rounded-xl border border-danger/40 bg-danger-soft px-6 py-10 text-center">
      <h1 className="text-xl font-bold text-danger">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink">
        The page could not be rendered. GitHub data problems are normally handled by falling back to sample data, so this is
        unexpected. Nothing was written anywhere.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
          Try again
        </button>
        <Link href="/" className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink">
          Back to the board
        </Link>
      </div>
    </div>
  );
}
