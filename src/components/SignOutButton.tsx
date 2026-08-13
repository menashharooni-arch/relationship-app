"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clearPersonScopedState, LAST_AUTH_UID_KEY } from "@/lib/account-state";
import { unbindDevicePush } from "@/lib/push-device";

export default function SignOutButton() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSignOut() {
    // Sever this DEVICE's push binding BEFORE the session goes away (the
    // DELETE needs auth) — otherwise the signed-out account's lead/view
    // notifications keep landing on this lock screen, where the next person
    // to use the device reads them. Bounded internally, never throws.
    await unbindDevicePush();
    try {
      await supabase.auth.signOut();
    } catch {
      /* clear locally + navigate anyway */
    }
    // Account-scoped client state must not survive into the NEXT session on
    // this browser — the active-card pointer, the visitor-identity blob that
    // attributes card views, the share/save maps, the device visitor id, and
    // any marketing-sketch prefill all belong to the account that just left.
    // One shared list (lib/account-state.ts) with AccountIsolationGuard, so
    // sign-out and account-switch can never disagree on what "clean" means.
    // (The guest draft is intentionally kept: it belongs to the person at the
    // keyboard, and it can only ever be claimed via the explicit account gate.)
    clearPersonScopedState({ includeGuestFlow: true });
    try {
      localStorage.removeItem(LAST_AUTH_UID_KEY);
    } catch {
      /* storage blocked — nothing to clear */
    }
    // HARD navigation to the marketing front page — a full reload guarantees no
    // stale client state or in-memory session survives the sign-out.
    window.location.href = "/";
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-gray-500 hover:text-white transition-colors"
    >
      Sign out
    </button>
  );
}
