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
