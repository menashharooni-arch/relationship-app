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
export default function ResetPasswordForm() {
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function init() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        // Strip the code from the URL either way — it's single-use and
        // shouldn't linger in browser history.
        window.history.replaceState({}, "", window.location.pathname);
        if (error) {
          setStage("no-session");
          return;
        }
      }
      const { data: { user } } = await supabase.auth.getUser();
      setStage(user ? "ready" : "no-session");
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client is stable across renders
  }, []);

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
        <p className="text-slate-600 text-sm">
          This password reset link is invalid or has expired. Request a new one from the sign-in page.
        </p>
        <a
          href="/login"
          className="inline-block w-full bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm"
        >
          Back to sign in
        </a>
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
