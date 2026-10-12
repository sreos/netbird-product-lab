import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-line bg-surface px-6 py-12 text-center">
      <h1 className="text-xl font-bold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That page does not exist in this prototype.</p>
      <Link href="/" className="mt-5 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
        Back to the board
      </Link>
    </div>
  );
}
