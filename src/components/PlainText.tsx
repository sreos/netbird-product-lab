import { Fragment } from "react";

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

/**
 * Renders untrusted issue text with just two bits of light formatting, **bold** and `code`,
 * built as React elements. No HTML is ever parsed or injected, so hostile input stays inert text.
 */
export function PlainText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i, lines) => (
        <Fragment key={i}>
          {line.split(INLINE).map((part, j) => {
            if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
              return <strong key={j}>{part.slice(2, -2)}</strong>;
            }
            if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
              return (
                <code key={j} className="rounded bg-surface-2 px-1 font-mono text-[0.85em]">
                  {part.slice(1, -1)}
                </code>
              );
            }
            return <Fragment key={j}>{part}</Fragment>;
          })}
          {i < lines.length - 1 ? "\n" : null}
        </Fragment>
      ))}
    </>
  );
}
