"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Sign-in shown INLINE on the /join/[token] invite page for a signed-out
// invitee (owner request): no detour to the login page, no password.
//   • Google — one tap with the invited email's Google account, or
//   • a passwordless email link sent to the INVITED address.
// Both land back on /join/<token> (via /auth/callback, which provisions a
// brand-new account through /onboarding first), where they accept the invite.
// The email is fixed to the invited address — the join API only accepts the
// invite under that email anyway, so offering a free-text field would just
// let people sign in as the wrong account and hit a dead end.
export default function JoinSignIn({ token, inviteEmail }: { token: string; inviteEmail: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const nextPath = `/join/${token}`;

  async function sendLink() {
    setStatus("sending");
    setError("");
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: inviteEmail,
        options: {
          // New invitees get an account created by the link itself — that's the
          // whole point: no password, no signup form.
          shouldCreateUser: true,
          emailRedirectTo: `${APP_URL}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (otpError) {
        setError(otpError.message);
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Couldn't send the link — please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 text-center">
        <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-white font-semibold text-sm">Check your email</p>
        <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
          We sent a sign-in link to <span className="text-gray-300 font-medium">{inviteEmail}</span>.
          Open it on this device and you&apos;ll land right back here to accept.
        </p>
        <button type="button" onClick={sendLink} className="text-blue-400 hover:text-blue-300 text-xs mt-3 transition-colors">
          Didn&apos;t get it? Send again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-gray-500 text-xs">
        Sign in as <span className="text-gray-300 font-medium">{inviteEmail}</span> to accept — no password needed.
      </p>

      {/* Google — the invited address's Google account signs them straight in. */}
      <GoogleSignInButton redirectTo={nextPath} />

      <div className="flex items-center gap-3" role="presentation">
        <span className="h-px flex-1 bg-gray-800" />
        <span className="text-gray-600 text-[11px]">or</span>
        <span className="h-px flex-1 bg-gray-800" />
      </div>

      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
      <button
        type="button"
        onClick={sendLink}
        disabled={status === "sending"}
        className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
      >
        {status === "sending" ? "Sending…" : `Email me a sign-in link`}
      </button>
      <p className="text-center text-gray-600 text-[11px]">
        One tap in that email signs you in — no password to create or remember.
      </p>
    </div>
  );
}
