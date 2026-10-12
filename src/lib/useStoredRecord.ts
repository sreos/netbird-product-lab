"use client";

import { useEffect, useState } from "react";

function load<T>(key: string, sanitize: (value: unknown) => T | null): Record<string, T> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, T> = {};
    for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
      const clean = sanitize(entry);
      if (clean !== null) out[id] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

function save(key: string, record: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Storage can be unavailable (private mode, blocked). The app works without persistence.
  }
}

/**
 * A map of per-issue entries persisted in localStorage.
 *
 * The first render is always empty so server and client markup match; saved data is read after
 * mount. Every entry is passed through `sanitize` (which must be a stable, module-level function)
 * because stored data is untrusted input. Nothing is written back until the load has happened,
 * so an empty first render can never overwrite saved work.
 */
export function useStoredRecord<T>(key: string, sanitize: (value: unknown) => T | null) {
  const [record, setRecord] = useState<Record<string, T>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRecord(load(key, sanitize));
    setHydrated(true);
  }, [key, sanitize]);

  useEffect(() => {
    if (hydrated) save(key, record);
  }, [key, record, hydrated]);

  return [record, setRecord] as const;
}
