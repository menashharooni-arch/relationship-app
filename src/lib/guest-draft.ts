"use client";

// ── Guest draft store (localStorage) + editor hook ───────────────────────────
// A guest can build a full Card (which also carries its SwiftLink + Email
// Signature — all one `cards` row) WITHOUT an account. Their work lives here in
// localStorage; nothing hits the DB until they authenticate and the draft is
// "claimed" (see src/app/api/drafts/claim + GuestDraftClaim).
//
// This module is browser-only but MUST stay importable in the node test env, so
// every entry point guards on `typeof localStorage`. It deliberately avoids
// next/navigation (uses window.location) so tests can import the store logic.
import { useCallback, useEffect, useState } from "react";

export const GUEST_DRAFT_KEY = "swiftcard_guest_draft";

// Event the editor fires (via requireAuth) to pop the auth gate. GuestGateModal
// listens for it — keeps the modal fully self-contained.
export const GUEST_GATE_EVENT = "swiftcard:guest-gate";

export type GuestDraft = {
  id: string;
  kind: "card";
  payload: Record<string, unknown>;
  images: Record<string, string>; // e.g. { logo: "data:…", photo: "data:…" }
  step: number;
  updatedAt: number;
};

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `d_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function readStorage(): GuestDraft | null {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(GUEST_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestDraft;
    if (!parsed || parsed.kind !== "card" || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    // Corrupt / unparseable draft → treat as none rather than crash the editor.
    return null;
  }
}

// In-memory copy so rapid saves merge without a storage round-trip; the debounced
// flush persists it. requireAuth flushes synchronously before it navigates.
let mem: GuestDraft | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function loadDraft(): GuestDraft | null {
  if (mem) return mem;
  mem = readStorage();
  return mem;
}

function writeNow(draft: GuestDraft): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota / private mode — the in-memory copy still carries the session */
  }
}

export function flushDraft(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (mem) writeNow(mem);
}

export function saveDraft(partial: Partial<GuestDraft>): void {
  const base: GuestDraft =
    mem ??
    readStorage() ?? {
      id: newId(),
      kind: "card",
      payload: {},
      images: {},
      step: 1,
      updatedAt: Date.now(),
    };

  mem = {
    ...base,
    ...partial,
    // payload/images are full snapshots from the editor — replace, don't merge.
    payload: partial.payload ?? base.payload,
    images: partial.images ?? base.images,
    id: base.id || newId(),
    kind: "card",
    updatedAt: Date.now(),
  };

  // Debounce the actual localStorage write — the editor calls this on every
  // keystroke.
  if (flushTimer) clearTimeout(flushTimer);
  if (typeof setTimeout !== "undefined") {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (mem) writeNow(mem);
    }, 400);
  } else if (mem) {
    writeNow(mem);
  }
}

export function clearDraft(): void {
  mem = null;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!storageAvailable()) return;
  try {
    localStorage.removeItem(GUEST_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function hasPendingDraft(): boolean {
  return loadDraft() !== null;
}

// Client-side auth heuristic: the @supabase/ssr session is stored in a cookie
// named `sb-<project-ref>-auth-token` (possibly chunked with .0/.1). Its presence
// means "logged in". The claim route re-verifies server-side regardless — this
// only decides whether the editor runs the action or pops the auth gate.
export function isAuthenticated(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?=/.test(document.cookie);
  } catch {
    return false;
  }
}

function openGate(action: string): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(GUEST_GATE_EVENT, { detail: { action } }));
  } catch {
    // Very old browsers without CustomEvent constructor — fall back to a direct
    // route so the flow never dead-ends.
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}&draft=1`;
  }
}

export function useGuestDraft(): {
  draft: GuestDraft | null;
  save: (p: Partial<GuestDraft>) => void;
  clear: () => void;
  requireAuth: (action: string, run: () => void) => void;
} {
  const [draft, setDraft] = useState<GuestDraft | null>(null);

  // Hydrate after mount (loadDraft touches localStorage → client-only, avoids an
  // SSR mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage after mount, avoids an SSR mismatch
    setDraft(loadDraft());
  }, []);

  const save = useCallback((p: Partial<GuestDraft>) => {
    saveDraft(p);
    setDraft(mem);
  }, []);

  const clear = useCallback(() => {
    clearDraft();
    setDraft(null);
  }, []);

  const requireAuth = useCallback((action: string, run: () => void) => {
    // Logged in → just do it. Guest → persist and pop the gate; the action is
    // retried after they come back and the draft is claimed.
    if (isAuthenticated()) {
      run();
      return;
    }
    flushDraft();
    openGate(action);
  }, []);

  return { draft, save, clear, requireAuth };
}
