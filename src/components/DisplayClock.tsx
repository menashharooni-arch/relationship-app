"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

// ── Times that hydrate cleanly ───────────────────────────────────────────────
// "Invited Sep 22" and "5 minutes ago" depend on WHEN and WHERE they are
// formatted. A client component renders twice — once on the server (UTC, at
// request time) and once in the browser to hydrate (the viewer's zone, a
// moment later) — and when the two disagree React throws hydration error #418
// and re-renders the whole tree. On the Office admin Team list that happened
// every evening in New York: from 8pm the server's UTC day is already
// tomorrow, so it printed "Invited Sep 23" and the browser "Invited Sep 22".
//
// The server passes its render time and the viewer's zone (the sc_tz cookie,
// UTC when absent) down once. While hydrating, times are formatted from THOSE,
// so both passes produce the same text; the moment hydration is done they
// switch to the browser's own clock and zone.

type Clock = { now: number; timeZone: string };

const ServerClock = createContext<Clock | null>(null);

export function DisplayClockProvider({ now, timeZone, children }: Clock & { children: ReactNode }) {
  return <ServerClock.Provider value={{ now, timeZone }}>{children}</ServerClock.Provider>;
}

// The browser's clock as an external store: one snapshot, refreshed every 30s
// while anything is subscribed, so "5 minutes ago" keeps itself current and
// every reader in a render sees the same instant. The server snapshot is 0 —
// "not hydrated yet" — which is what React uses on the server AND during
// hydration.
let liveNow = 0;
let ticker: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!ticker) {
    ticker = setInterval(() => {
      liveNow = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(onChange);
    if (!listeners.size && ticker) {
      clearInterval(ticker);
      ticker = undefined;
    }
  };
}
function getSnapshot() {
  if (!liveNow) liveNow = Date.now();
  return liveNow;
}
const getServerSnapshot = () => 0;

/**
 * `now` and `timeZone` to format display times with. Before hydration: the
 * server's values (identical on both passes). After: the live clock and the
 * browser's zone (timeZone undefined = local).
 */
export function useDisplayClock(): { now: number; timeZone: string | undefined } {
  const live = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const server = useContext(ServerClock);
  if (!live) {
    // No provider: a fixed instant on both passes still matches ("Just now"
    // for anything recent), and hydration swaps in the real value.
    return { now: server?.now ?? 0, timeZone: server?.timeZone ?? "UTC" };
  }
  return { now: live, timeZone: undefined };
}
