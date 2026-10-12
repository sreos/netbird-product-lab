"use client";

import { useId, useState } from "react";

type Tone = "ok" | "warn" | "danger" | "info" | "neutral";
type PeerStatus = "connected" | "connecting" | "waiting" | "reconnecting";

interface MockState {
  id: string;
  tab: string;
  kind: "reported" | "proposed";
  badge: string;
  tone: Tone;
  icon: string;
  headline: string;
  detail: string;
  action?: string;
  peers: Array<{ name: string; status: PeerStatus }>;
  cli: string[];
  rationale: string[];
}

const PEERS = ["build-runner-01", "db-server", "laptop-ana", "nas-home", "ci-runner-02"];
const peers = (statuses: PeerStatus[]) => PEERS.map((name, i) => ({ name, status: statuses[i] }));

const STATES: MockState[] = [
  {
    id: "reported",
    tab: "1. As reported",
    kind: "reported",
    badge: "Connected",
    tone: "ok",
    icon: "✓",
    headline: "Connected",
    detail: "Nothing on screen says the sign-in has expired.",
    peers: peers(["connected", "connecting", "connecting", "connected", "connecting"]),
    cli: ["Management: Connected", "Signal: Connected", "Peers count: 2/5 Connected"],
    rationale: [
      "This is the problem described in the issue: the headline is green while three peers are stuck on “Connecting”.",
      "A user or script that trusts the headline has no reason to run a manual disconnect and reconnect.",
      "The state is drawn from the issue text. It is not a recording of any NetBird version.",
    ],
  },
  {
    id: "expiring",
    tab: "2. Expiring soon",
    kind: "proposed",
    badge: "Sign-in expires soon",
    tone: "warn",
    icon: "⚠",
    headline: "Your sign-in expires in 2 hours",
    detail: "Connections keep working until then. Signing in again now avoids an interruption.",
    action: "Sign in now",
    peers: peers(["connected", "connected", "connected", "connected", "connected"]),
    cli: ["Management: Connected", "Signal: Connected", "Session: valid, expires in 2h", "Peers count: 5/5 Connected"],
    rationale: [
      "Gives interactive users a calm, early warning with a single action.",
      "Skipped for headless machines, which should rely on silent refresh or on setup-key enrolment instead.",
      "Open question: can the client know the expiry time for every identity provider? If not, this state is dropped.",
    ],
  },
  {
    id: "refreshing",
    tab: "3. Refreshing",
    kind: "proposed",
    badge: "Refreshing sign-in",
    tone: "info",
    icon: "⟳",
    headline: "Refreshing your sign-in…",
    detail: "The client is renewing the session in the background. No action is needed yet.",
    peers: peers(["connected", "reconnecting", "reconnecting", "connected", "reconnecting"]),
    cli: ["Management: Connected", "Signal: Connected", "Session: refreshing", "Peers count: 2/5 Connected"],
    rationale: [
      "Makes the silent refresh visible, so a short dip in connectivity has an explanation.",
      "Must time out into the next state instead of spinning forever; that is the failure mode being fixed.",
    ],
  },
  {
    id: "expired",
    tab: "4. Sign-in required",
    kind: "proposed",
    badge: "Sign-in required",
    tone: "danger",
    icon: "✕",
    headline: "Sign in again to restore your connections",
    detail: "Your session expired at 14:12 UTC, so some peers can no longer be reached.",
    action: "Sign in again",
    peers: peers(["connected", "waiting", "waiting", "connected", "waiting"]),
    cli: [
      "Management: Connected",
      "Signal: Connected",
      "Session: expired (since 14:12 UTC)",
      "Peers count: 2/5 Connected",
      "Action required: run `netbird up` to sign in again",
    ],
    rationale: [
      "The headline stops claiming health. The cause and the fix are stated in one place.",
      "Peers say “Waiting for sign-in” instead of the generic “Connecting”, which points at the cause.",
      "For unattended machines the same state should be machine-readable (for example a status field and a non-zero exit code) so monitoring can alert.",
    ],
  },
  {
    id: "restored",
    tab: "5. Restored",
    kind: "proposed",
    badge: "Connected",
    tone: "ok",
    icon: "✓",
    headline: "Signed in again. Connected to 5 of 5 peers",
    detail: "Session valid. Your connections have been restored.",
    peers: peers(["connected", "connected", "connected", "connected", "connected"]),
    cli: ["Management: Connected", "Signal: Connected", "Session: valid, expires in 24h", "Peers count: 5/5 Connected"],
    rationale: [
      "Confirms the recovery so users do not have to guess whether the sign-in worked.",
      "Success metric: time from expiry to a restored state, tracked for support cases.",
    ],
  },
];

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-accent-soft text-accent",
  neutral: "bg-surface-2 text-muted",
};

const PEER_LABEL: Record<PeerStatus, { text: string; tone: Tone; icon: string }> = {
  connected: { text: "Connected", tone: "ok", icon: "✓" },
  connecting: { text: "Connecting", tone: "neutral", icon: "…" },
  waiting: { text: "Waiting for sign-in", tone: "danger", icon: "✕" },
  reconnecting: { text: "Reconnecting", tone: "info", icon: "⟳" },
};

export function ConnectionStateMock() {
  const [activeId, setActiveId] = useState(STATES[0].id);
  const groupId = useId();
  const state = STATES.find((s) => s.id === activeId) ?? STATES[0];
  const connectedCount = state.peers.filter((p) => p.status === "connected").length;

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Choose a state to preview</legend>
        <div className="flex flex-wrap gap-2">
          {STATES.map((s) => {
            const checked = s.id === activeId;
            const id = `${groupId}-${s.id}`;
            return (
              <div key={s.id}>
                <input
                  id={id}
                  type="radio"
                  name={groupId}
                  value={s.id}
                  checked={checked}
                  onChange={() => setActiveId(s.id)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={id}
                  className={`block cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                    checked ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink hover:bg-surface-2"
                  }`}
                >
                  {s.tab}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <div role="group" aria-label="Concept mock of a client status window" className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted">
              <span className="font-semibold uppercase tracking-wide">Concept mock · not a real client</span>
              <span>{state.kind === "reported" ? "Current behavior (reported)" : "Proposed"}</span>
            </div>
            <div aria-live="polite" className="space-y-4 p-4">
              <div className={`rounded-lg p-4 ${TONE_CLASS[state.tone]}`}>
                <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                  <span aria-hidden="true">{state.icon}</span>
                  {state.badge}
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">{state.headline}</p>
                <p className="mt-0.5 text-sm text-ink">{state.detail}</p>
                {state.action && (
                  <button
                    type="button"
                    className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink"
                    onClick={() => setActiveId(state.id === "expired" ? "restored" : "refreshing")}
                  >
                    {state.action}
                  </button>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">
                  Peers <span className="font-normal text-muted">({connectedCount} of {state.peers.length} connected)</span>
                </p>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {state.peers.map((p) => {
                    const meta = PEER_LABEL[p.status];
                    return (
                      <li key={p.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="font-mono text-ink">{p.name}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[meta.tone]}`}>
                          <span aria-hidden="true">{meta.icon}</span>
                          {meta.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          <figure>
            <figcaption className="mb-1 text-sm font-semibold text-ink">Equivalent CLI output (illustrative)</figcaption>
            <pre
              tabIndex={0}
              role="region"
              aria-label="Illustrative CLI output"
              className="overflow-x-auto rounded-lg border border-line bg-surface p-3 font-mono text-xs leading-relaxed text-ink"
            >
              <code>{["$ netbird status", ...state.cli].join("\n")}</code>
            </pre>
            <p className="mt-1 text-xs text-muted">
              Wording and field names are invented for this concept. They are not NetBird&rsquo;s real output.
            </p>
          </figure>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 lg:self-start">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Design rationale</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-ink">
            {state.rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            State is never conveyed by colour alone: every status pairs an icon with text, and changes are announced to screen
            readers.
          </p>
        </div>
      </div>
    </div>
  );
}
