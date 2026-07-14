"use client";

import { createBrowserClient } from "@supabase/ssr";

export default function SignOutButton() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      /* clear locally + navigate anyway */
    }
    // Account-scoped client state must not survive into the NEXT session on
    // this browser — the active-card pointer and any marketing-sketch prefill
    // belong to the account that just left, not whoever signs in after.
    // (The guest draft is intentionally kept: it belongs to the person at the
    // keyboard, and it can only ever be claimed via the explicit account gate.)
    try {
      localStorage.removeItem("swiftcard_active_card");
      localStorage.removeItem("swiftcard_prefill");
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
