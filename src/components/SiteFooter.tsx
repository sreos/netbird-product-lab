export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-7xl space-y-3 px-4 py-8 text-sm text-muted sm:px-6 lg:px-8">
        <p>
          <strong className="text-ink">Disclaimer.</strong> NetBird Product Lab is an independent portfolio prototype. It is
          not affiliated with, endorsed by, or sponsored by NetBird or its maintainers. &ldquo;NetBird&rdquo; is used only to
          identify the public open-source projects whose issues are analysed. No NetBird logo or branding is used.
        </p>
        <p>
          Issue text belongs to its original authors and is read from the public{" "}
          <a className="underline underline-offset-2 hover:text-ink" href="https://docs.github.com/en/rest/issues" rel="noopener noreferrer" target="_blank">
            GitHub REST API
          </a>{" "}
          (read-only). Categories, scores, and drafts are this prototype&rsquo;s own inferences and may be wrong; always check
          the source issue.
        </p>
        <p>
          Sources:{" "}
          <a className="underline underline-offset-2 hover:text-ink" href="https://github.com/netbirdio/netbird" rel="noopener noreferrer" target="_blank">
            netbirdio/netbird
          </a>
          ,{" "}
          <a className="underline underline-offset-2 hover:text-ink" href="https://github.com/netbirdio/dashboard" rel="noopener noreferrer" target="_blank">
            netbirdio/dashboard
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
