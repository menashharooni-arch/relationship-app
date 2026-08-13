// ── Person-scoped browser state ──────────────────────────────────────────────
//
// Everything in localStorage/cookies that describes WHO is using this browser,
// as opposed to the device or unclaimed content. None of it may survive an
// account switch: the active-card pointer, the "I already shared my info"
// identity blob, and the per-device visitor id were all outliving logout/login,
// which is how one account's card, identity, and analytics attribution bled
// into the next (a view by one user recorded under another user's name, the
// nav opening the previous account's card, conversation timelines merging two
// people who used the same browser).
//
// Two call sites, one list:
//   • SignOutButton — clears on explicit sign-out.
//   • AccountIsolationGuard — clears when the AUTHENTICATED USER CHANGES,
//     which also covers logging in over an existing session (no sign-out
//     event fires there) and the native shell reopening on a stale webview.
//
// Deliberately NOT in either list:
//   • swiftcard_guest_draft — belongs to the person at the keyboard; it can
//     only enter an account through the explicit claim gate.
//   • swiftcard_apns_endpoint — the device's push token. The SERVER row that
//     binds it to an account is what gets severed (see push-device.ts); the
//     token itself is hardware-scoped and stays.
//   • sc_theme / tour flags — cosmetic device preferences; no identity
//     content. (sc_has_acct is gone entirely: persisting it let a signed-out
//     device keep reading "existing customer" and suppressed the signup nudge
//     — SignupNudgeHost now caches that answer in memory with a short TTL.)

/**
 * Identity-bearing keys. Wiped on ANY auth-user mismatch — including the very
 * first sign-in on a browser whose state was never stamped with a uid, because
 * whatever accumulated before this guard existed is of unknown provenance and
 * a one-time reset is exactly what clears the misattributed identities already
 * sitting on devices.
 */
export const PERSON_SCOPED_STORAGE_KEYS = [
  // Which card is selected — previous account's slug must not steer the nav.
  "swiftcard_active_card",
  // The visitor identity blob share forms prefill from and CardEventTracker
  // attributes views with — THE "wrong viewer name" bug.
  "swiftcard_visitor",
  // Per-owner "already shared / already saved" maps for that identity.
  "swiftcard_shared",
  "swiftcard_saved",
  // The per-device visitor id. Rotating it on account change keeps two humans
  // on one device from being merged into a single "visitor" in analytics and
  // conversation matching.
  "kontact_vid",
] as const;

/**
 * Guest-flow keys. Written by a GUEST before signup and consumed once AFTER
 * login (plan intent on /welcome, the marketing sketch in /cards/new) — so the
 * guest→first-login transition must keep them or the "pick a plan → sign up →
 * checkout" continuation silently breaks. They are wiped only on a REAL
 * account switch (one signed-in user replaced by a different one), where a
 * previous account's intent firing for the next user would be its own bleed.
 */
export const GUEST_FLOW_STORAGE_KEYS = [
  "swiftcard_prefill",
  "swiftcard_plan_intent",
] as const;

/** Which auth user this browser's person-scoped state belongs to. */
export const LAST_AUTH_UID_KEY = "sc_last_uid";

/** Cookie mirror of the active card — must die with the localStorage copy. */
const ACTIVE_CARD_COOKIE = "sc_active_card";

/**
 * Should person-scoped (identity) state be reset for this session user?
 * The pure decision, testable without a browser.
 *
 * • No session (uid null): never wipe here. An anonymous person may be the
 *   same human who just signed out, and their share-state is theirs; explicit
 *   sign-out does its own clearing.
 * • Session for the SAME uid the state was stamped with: keep everything.
 * • Session for a DIFFERENT uid — or state not yet stamped with any uid — wipe.
 */
export function shouldResetPersonState(
  lastUid: string | null,
  sessionUid: string | null,
): boolean {
  if (!sessionUid) return false;
  return lastUid !== sessionUid;
}

/**
 * A REAL account switch: one signed-in user replaced by a different one.
 * Strictly narrower than shouldResetPersonState — the guest→first-login
 * transition (lastUid null) is NOT a switch, so guest-flow keys survive it.
 */
export function isAccountSwitch(
  lastUid: string | null,
  sessionUid: string | null,
): boolean {
  return !!sessionUid && !!lastUid && lastUid !== sessionUid;
}

/**
 * Remove person-scoped keys (localStorage, the sessionStorage fallback copies,
 * and the cookie mirror). Pass `includeGuestFlow` on a real account switch.
 */
export function clearPersonScopedState(opts?: { includeGuestFlow?: boolean }): void {
  if (typeof window === "undefined") return;
  const keys: readonly string[] = opts?.includeGuestFlow
    ? [...PERSON_SCOPED_STORAGE_KEYS, ...GUEST_FLOW_STORAGE_KEYS]
    : PERSON_SCOPED_STORAGE_KEYS;
  for (const key of keys) {
    try { localStorage.removeItem(key); } catch { /* storage blocked */ }
    // getVisitorId falls back to sessionStorage in private mode — clear both.
    try { sessionStorage.removeItem(key); } catch { /* storage blocked */ }
  }
  try {
    document.cookie = `${ACTIVE_CARD_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } catch { /* ignore */ }
}

// ── Identity-reconciled barrier ──────────────────────────────────────────────
//
// AccountIsolationGuard reconciles inside a getSession() promise callback, but
// trackers read localStorage synchronously in their mount effects — so the
// first tracked view after an account switch used to ship the PREVIOUS
// person's visitor id and identity blob before the guard's wipe landed.
// Anything that attributes identity from browser state must await this first.
//
// Resolves when the guard finishes its first reconcile; falls back after a
// short timeout so a broken auth client can never block tracking forever
// (worst case is the old, pre-barrier behavior).
let reconciled = false;
let resolveReconciled: (() => void) | null = null;
const reconciledPromise: Promise<void> = typeof window === "undefined"
  ? Promise.resolve()
  : new Promise((resolve) => { resolveReconciled = resolve; });

export function markIdentityReconciled(): void {
  reconciled = true;
  resolveReconciled?.();
}

export function whenIdentityReconciled(timeoutMs = 2000): Promise<void> {
  if (reconciled || typeof window === "undefined") return Promise.resolve();
  return Promise.race([
    reconciledPromise,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export function readLastAuthUid(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(LAST_AUTH_UID_KEY); } catch { return null; }
}

export function writeLastAuthUid(uid: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (uid) localStorage.setItem(LAST_AUTH_UID_KEY, uid);
    else localStorage.removeItem(LAST_AUTH_UID_KEY);
  } catch { /* storage blocked */ }
}
