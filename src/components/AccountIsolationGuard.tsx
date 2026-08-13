"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  clearPersonScopedState,
  isAccountSwitch,
  markIdentityReconciled,
  readLastAuthUid,
  shouldResetPersonState,
  writeLastAuthUid,
} from "@/lib/account-state";

// ── Account isolation guard ──────────────────────────────────────────────────
//
// Mounted once in the root layout; renders nothing. Its one job: the moment
// this browser's AUTHENTICATED USER is not the user its person-scoped state
// was stamped with, reset that state (lib/account-state.ts) and sever the
// device's push binding (lib/push-device.ts).
//
// Why SignOutButton alone is not enough: logging in over an existing session
// (the /login page never forces a sign-out first), the native shell reopening
// on a webview whose cookies rotated, and any sign-out path that isn't the
// button (session expiry, account deletion) all change the user WITHOUT that
// button's cleanup running. This guard closes every one of those paths by
// checking identity itself, on every page load and on every auth state change.
//
// The check is two localStorage reads and a local session decode — no network.
export default function AccountIsolationGuard() {
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const reconcile = (sessionUid: string | null) => {
      const lastUid = readLastAuthUid();
      if (!shouldResetPersonState(lastUid, sessionUid)) return;

      const realSwitch = isAccountSwitch(lastUid, sessionUid);
      clearPersonScopedState({ includeGuestFlow: realSwitch });
      writeLastAuthUid(sessionUid);

      // A login this state wasn't stamped with means the device's push binding
      // belongs to nobody: the old account must stop reaching this lock
      // screen, and the new one gets pushes only after it opts in itself.
      // Not just realSwitch — a sign-out whose server DELETE failed (offline)
      // followed by a fresh login lands here with lastUid null, and the stale
      // binding would otherwise keep pushing the previous account's activity
      // to this device. Fire-and-forget — identity hygiene must never delay a
      // page.
      void import("@/lib/push-device").then(({ unbindDevicePush }) => unbindDevicePush()).catch(() => {});
    };

    // getSession() decodes the cookie locally (no network) — all that's needed
    // here is the uid to compare. Server code never trusts this value; it does
    // its own getUser()/getClaims() per request.
    supabase.auth.getSession().then(({ data: { session } }) => {
      reconcile(session?.user?.id ?? null);
    }).finally(() => {
      // Trackers hold their first event until this first pass lands, so a view
      // right after an account switch can't ship the previous person's ids.
      markIdentityReconciled();
    });

    // Belt and braces for auth changes that happen without a full navigation
    // (multi-tab sign-ins broadcast here too).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      reconcile(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
