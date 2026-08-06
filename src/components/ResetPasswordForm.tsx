"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Stage = "checking" | "ready" | "no-session" | "saving" | "done" | "error";

// Reached directly via the "Forgot password" email link (resetPasswordForEmail's
// redirectTo now points straight here, not through /auth/callback?next=... — that
// relay depended on Supabase's redirect-URL allowlist preserving an extra query
// param on top of /auth/callback, which it doesn't always honor, silently falling
// back to the default Site URL and landing the user on the dashboard with no way
// to set a new password). This page exchanges the recovery `code` itself, client-side.
// Pinned to the SwiftCard domain for the same reason LoginForm is: an
// origin-based redirect breaks the flow on any non-allowlisted host.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export default function ResetPasswordForm() {
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function init() {
      const params = new URLSearchParams(window.location.search);
      // The recovery link arrives in one of three shapes, and only the first
      // was handled. That mattered because the first is the ONE that is
      // device-bound: exchangeCodeForSession is PKCE, and the code verifier
      // lives in the localStorage of whichever device REQUESTED the reset. So
      // the single most ordinary path — request it on the laptop, open the
      // email on the phone — always failed, and the page blamed the link
      // ("invalid or has expired"). Re-requesting reproduced it exactly, which
      // made it a self-repeating dead end for someone who already can't get in.
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      // Implicit flow puts the tokens in the URL fragment instead.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      let failed = false;

      if (tokenHash) {
        // Device-INDEPENDENT: the hash is verified server-side by Supabase,
        // with no local verifier involved.
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: (type as "recovery") || "recovery",
        });
        failed = !!error;
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        failed = !!error;
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        failed = !!error;
      }

      // Strip the credential from the URL either way — single-use, and it
      // shouldn't linger in browser history.
      window.history.replaceState({}, "", window.location.pathname);

      if (failed) {
        setStage("no-session");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      setStage(user ? "ready" : "no-session");
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client is stable across renders
  }, []);

  // A resend, right where the failure is. Sending them back to /login to start
  // over is what made this loop: the same request produces the same
  // device-bound link and the same dead end.
  async function resend() {
    setErrorMsg("");
    const target = resendEmail.trim();
    if (!target) return;
    setResendState("sending");
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${APP_URL}/reset-password`,
    });
    // Deliberately the same outcome either way: whether an account exists for
    // an address is not something an unauthenticated form should reveal.
    setResendState(error ? "sent" : "sent");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Passwords don't match.");
      return;
    }
    setStage("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setStage("ready");
      return;
    }
    setStage("done");
    setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
  }

  if (stage === "checking") {
    return <p className="text-slate-400 text-sm text-center">Checking your link…</p>;
  }

  if (stage === "no-session") {
    return (
      <div className="text-center space-y-4">
        {resendState === "sent" ? (
          <>
            <p className="text-slate-600 text-sm">
              If there&apos;s an account for that address, a new reset link is on its way. Open it on
              <span className="font-semibold"> this device</span> and you&apos;ll be able to set a new password.
            </p>
            <a
              href="/login"
              className="inline-block w-full bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm"
            >
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <p className="text-slate-600 text-sm">
              We couldn&apos;t use that reset link — it may have expired, already been used, or been
              opened on a different device from the one that asked for it.
            </p>
            {/* The resend lives HERE rather than back on /login. Sending someone
                to start over is what made this a loop: the same request
                produces the same link and the same failure. */}
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full border border-slate-300 rounded-full px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
            />
            <button
              type="button"
              onClick={resend}
              disabled={resendState === "sending" || !resendEmail.trim()}
              className="w-full bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm"
            >
              {resendState === "sending" ? "Sending…" : "Send me a new link"}
            </button>
            <a href="/login" className="inline-block text-sm text-slate-500 hover:text-slate-700 transition-colors">
              Back to sign in
            </a>
          </>
        )}
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="text-center space-y-2">
        <p className="text-green-600 text-sm font-semibold">Password updated ✓</p>
        <p className="text-slate-400 text-xs">Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="password"
        placeholder="New password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full bg-white border border-[#E4DDD4] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
      />
      <input
        type="password"
        placeholder="Confirm new password"
        required
        minLength={6}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full bg-white border border-[#E4DDD4] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
      />

      {errorMsg && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}

      <button
        type="submit"
        disabled={stage === "saving"}
        className="w-full bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm"
      >
        {stage === "saving" ? "Saving…" : "Set new password →"}
      </button>
    </form>
  );
}
