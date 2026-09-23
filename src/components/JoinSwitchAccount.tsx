"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { clearPersonScopedState, LAST_AUTH_UID_KEY } from "@/lib/account-state";
import { unbindDevicePush } from "@/lib/push-device";

// The /join page when the browser is signed in as SOMEONE ELSE. The invite can
// only be accepted by the invited address (/api/join refuses anything else),
// so the page used to show "Accept invitation" anyway — a button guaranteed to
// fail with a 403 — with the way out as small grey "Switch account" text that
// led to a password form. Here the way out IS the button: sign out (the same
// clean-up SignOutButton does), then reload this page, which now shows the
// invite's own sign-in — Google or an emailed link to the invited address.
export default function JoinSwitchAccount({ inviteEmail }: { inviteEmail: string }) {
  const [busy, setBusy] = useState(false);

  async function switchAccount() {
    if (busy) return;
    setBusy(true);
    await unbindDevicePush();
    try {
      await createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ).auth.signOut();
    } catch {
      /* clear locally + reload anyway */
    }
    clearPersonScopedState({ includeGuestFlow: true });
    try {
      localStorage.removeItem(LAST_AUTH_UID_KEY);
    } catch {
      /* storage blocked — nothing to clear */
    }
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={switchAccount}
      disabled={busy}
      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
    >
      {busy ? "Signing out…" : `Continue as ${inviteEmail}`}
    </button>
  );
}
