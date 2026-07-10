"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Auth redirects are pinned to the SwiftCard domain, NOT window.location.origin.
// Origin-based redirects break sign-in if the form is ever loaded on a Vercel
// preview host (Supabase would reject the non-allowlisted redirect and the PKCE
// exchange would fail cross-host). Every login / signup / Google / reset flow
// therefore routes through swiftcard.me.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export default function LoginForm({ redirectTo, initialMode = "signin" }: { redirectTo?: string; initialMode?: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // Surface a failed OAuth round-trip (auth/callback redirects here with
  // ?error=oauth) instead of silently landing the visitor back on the form.
  // Read after mount — reading the URL during render would mismatch SSR.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("error") === "oauth") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL after mount, avoids SSR mismatch
        setErrorMsg("Google sign-in didn't complete — please try again.");
      }
    } catch { /* ignore */ }
  }, []);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Creating a NEW account must never inherit a session already in this browser —
  // otherwise the visitor can end up inside the previously-logged-in account and
  // it looks like their new email "linked" to it. Local sign-out only (other
  // devices stay signed in).
  async function clearExistingSession() {
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* no session — fine */ }
  }

  async function handleGoogle() {
    if (mode === "signup") await clearExistingSession();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${APP_URL}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMsg(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
        setStatus("error");
      } else {
        window.location.href = redirectTo ?? "/dashboard";
      }
    } else {
      await clearExistingSession();
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${APP_URL}/auth/callback` } });
      if (error) {
        setErrorMsg(error.message);
        setStatus("error");
      } else {
        window.location.href = redirectTo ?? "/onboarding";
      }
    }
  }

  async function handleForgot() {
    if (!email) {
      setErrorMsg("Enter your email first.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Straight to the "set a new password" page, which exchanges the code
      // itself — NOT /auth/callback?next=..., which depends on Supabase's
      // redirect-URL allowlist preserving that extra query param (it doesn't
      // reliably), silently falling back to the dashboard instead.
      redirectTo: `${APP_URL}/auth/reset-password`,
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      // A dedicated confirmation screen, not an inline message styled like an
      // error — this was a real success, not a validation failure.
      setForgotSent(true);
      setStatus("idle");
    }
  }

  if (forgotSent) {
    return (
      <div className="w-full text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-slate-900 font-semibold text-base">Check your email</p>
          <p className="text-slate-500 text-sm mt-1.5">
            We sent a password reset link to <span className="font-medium text-slate-700">{email}</span>. Click it to set a new password.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setForgotSent(false); setErrorMsg(""); }}
          className="w-full bg-[#1D4ED8] hover:bg-[#1740C4] text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      {/* Mode toggle */}
      <div className="flex bg-[#EDE8E0] border border-[#E4DDD4] rounded-full p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setStatus("idle"); setErrorMsg(""); }}
            className="flex-1 py-2 text-sm font-semibold rounded-full transition-colors"
            style={{
              background: mode === m ? "#1D4ED8" : "transparent",
              color: mode === m ? "#fff" : "#8B8070",
            }}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="your@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white border border-[#E4DDD4] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
        />
        <input
          type="password"
          placeholder="Password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white border border-[#E4DDD4] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
        />

        {errorMsg && (
          <p className="text-red-400 text-xs text-center">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm"
        >
          {status === "loading"
            ? "…"
            : mode === "signin" ? "Sign in →" : "Create account →"}
        </button>
      </form>

      {mode === "signin" && (
        <button
          type="button"
          onClick={handleForgot}
          disabled={status === "loading"}
          className="w-full text-center text-slate-400 hover:text-slate-600 text-xs transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "Sending…" : "Forgot password?"}
        </button>
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#E4DDD4]" />
        <span className="text-slate-400 text-xs">or</span>
        <div className="flex-1 h-px bg-[#E4DDD4]" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-6 rounded-full transition-colors text-sm"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>
    </div>
  );
}
