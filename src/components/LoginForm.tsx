"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useIsNativeApp } from "@/lib/platform";
import GoogleSignInButton from "@/components/GoogleSignInButton";

// Auth redirects are pinned to the SwiftCard domain, NOT window.location.origin.
// Origin-based redirects break sign-in if the form is ever loaded on a Vercel
// preview host (Supabase would reject the non-allowlisted redirect and the PKCE
// exchange would fail cross-host). Every login / signup / Google / reset flow
// therefore routes through swiftcard.me.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export default function LoginForm({ redirectTo, initialMode = "signin", isReferral = false }: { redirectTo?: string; initialMode?: "signin" | "signup"; isReferral?: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const native = useIsNativeApp();

  // SwiftCard is invite-only for new accounts. Office-team invitees (arriving
  // with next=/join/<token>) are pre-authorized by their invite, so they don't
  // need a code — the /onboarding gate lets their pending office invite through.
  // Referred friends (/r/CODE → ?ref=1) are likewise pre-authorized: their
  // sc_ref cookie is validated server-side at /onboarding.
  const isOfficeInvite = !!(redirectTo && redirectTo.startsWith("/join/"));
  const skipInviteCode = isOfficeInvite || isReferral;

  // Verify the invite code before any signup path (email OR Google/Apple). On
  // success the server sets a short-lived cookie that /onboarding re-checks
  // before it will provision the account. No-op for sign-in and office invites.
  async function ensureInviteVerified(): Promise<boolean> {
    if (mode !== "signup" || skipInviteCode) return true;
    const code = inviteCode.trim();
    if (!code) {
      setErrorMsg("An invite code is required to create an account.");
      setStatus("error");
      return false;
    }
    try {
      const res = await fetch("/api/invite/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "That invite code isn't valid.");
        setStatus("error");
        return false;
      }
      return true;
    } catch {
      setErrorMsg("Couldn't verify your invite code — please try again.");
      setStatus("error");
      return false;
    }
  }

  // Surface a failed OAuth round-trip (auth/callback redirects here with
  // ?error=oauth) instead of silently landing the visitor back on the form.
  // Read after mount — reading the URL during render would mismatch SSR.
  useEffect(() => {
    try {
      const err = new URLSearchParams(window.location.search).get("error");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL after mount, avoids SSR mismatch
      if (err === "oauth") {
        setErrorMsg("Google sign-in didn't complete — please try again.");
      } else if (err === "invite_only") {
        // Onboarding rejected an uninvited new account — nudge them to the
        // invite-code signup instead of leaving them confused on the sign-in tab.
        setErrorMsg("SwiftCard is invite-only right now — you need an invite code to create an account.");
        setMode("signup");
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
    if (mode === "signup" && !(await ensureInviteVerified())) return;
    if (mode === "signup") await clearExistingSession();
    // NATIVE: OAuth must run in the SYSTEM browser (SFSafariViewController) —
    // Google blocks embedded-webview OAuth (403 disallowed_useragent). The
    // round-trip returns via the swiftcard:// scheme and NativeAppBridge
    // completes the session in the webview. See src/lib/native-auth.ts.
    if (native) {
      const { startNativeOAuth } = await import("@/lib/native-auth");
      const err = await startNativeOAuth(supabase, "google", redirectTo);
      if (err) { setErrorMsg(err); setStatus("error"); }
      return;
    }
    // Carry a same-origin `next` (e.g. the guest editor) through the OAuth
    // round-trip so the callback can return the user to where they left off.
    const safeNext = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : null;
    const callback = safeNext
      ? `${APP_URL}/auth/callback?next=${encodeURIComponent(safeNext)}`
      : `${APP_URL}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      // Force Google's account chooser every time — without this, a browser
      // that already has one Google session signed in skips straight past
      // account selection and logs into that account silently, which is
      // wrong for anyone juggling multiple Google accounts.
      options: { redirectTo: callback, queryParams: { prompt: "select_account" } },
    });
  }

  // Sign in with Apple — mirrors handleGoogle. Rendered only in the native app.
  // Supabase's Apple provider isn't enabled on the project yet (a separate owner
  // action), so today this call returns an error; we catch it and surface it as
  // a normal user-facing message rather than letting it throw. Inert but safe.
  async function handleApple() {
    if (mode === "signup" && !(await ensureInviteVerified())) return;
    if (mode === "signup") await clearExistingSession();
    try {
      // Same system-browser flow as native Google — consistent, and avoids
      // running Apple's auth page inside the embedded webview.
      const { startNativeOAuth } = await import("@/lib/native-auth");
      const err = await startNativeOAuth(supabase, "apple", redirectTo);
      if (err) {
        setErrorMsg(err.includes("not enabled") ? "Apple sign-in isn't available right now — please try again." : err);
        setStatus("error");
      }
    } catch {
      setErrorMsg("Apple sign-in isn't available right now — please try again.");
      setStatus("error");
    }
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
      if (!(await ensureInviteVerified())) return;
      await clearExistingSession();
      // Carry a same-origin `next` (e.g. a team invite, or the guest editor)
      // through email-confirmation too — mirrors handleGoogle/handleApple.
      // Without this, a signup with confirmation enabled sends the user to
      // /auth/callback with no `next` once they click the emailed link, so
      // e.g. an invited employee never returns to /join/<token> to accept
      // (auth audit — the invite was silently dropped).
      const safeNext = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : null;
      const emailRedirectTo = safeNext
        ? `${APP_URL}/auth/callback?next=${encodeURIComponent(safeNext)}`
        : `${APP_URL}/auth/callback`;
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
      if (error) {
        setErrorMsg(error.message);
        setStatus("error");
      } else {
        // New accounts must pass through /onboarding (profile provisioning +
        // referral). This branch only runs when confirmation is OFF and a
        // session came back immediately; the confirmation-required case is
        // handled by emailRedirectTo above instead.
        window.location.href = safeNext ? `/onboarding?next=${encodeURIComponent(safeNext)}` : "/onboarding";
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

        {mode === "signup" && !skipInviteCode && (
          <div>
            <input
              type="text"
              placeholder="Invite code"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoCapitalize="characters"
              className="w-full bg-white border border-[#E4DDD4] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1D4ED8] transition-colors"
            />
            <p className="text-center text-[11px] text-slate-400 mt-1.5">
              SwiftCard is invite-only right now. Have a code? Enter it to join.
            </p>
          </div>
        )}

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

        {mode === "signup" && (
          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            By creating an account you agree to our{" "}
            <a href="/terms" className="underline hover:text-slate-600">Terms</a> and{" "}
            <a href="/privacy" className="underline hover:text-slate-600">Privacy Policy</a>.
          </p>
        )}
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

      {/* WEB: Google Identity Services (ID-token flow) — keeps the raw
          *.supabase.co domain out of Google's account chooser. NATIVE: the
          Capacitor iOS shell keeps its existing OAuth-redirect flow untouched.
          `native` is false on the server and first client render, so web always
          gets the GIS button with no hydration mismatch; native flips to the
          old button after mount (and GoogleSignInButton is a hard no-op in
          native regardless). */}
      {native ? (
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
      ) : (
        <GoogleSignInButton redirectTo={redirectTo} />
      )}

      {/* Native app only: Sign in with Apple (Apple requires it alongside other
          social logins in-app). Renders nothing on web. */}
      {native && (
        <button
          type="button"
          onClick={handleApple}
          className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-900 text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm mt-3"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
            <path d="M16.365 1.43c0 1.14-.42 2.2-1.13 3-.77.88-2.02 1.56-3.06 1.48-.13-1.1.42-2.28 1.09-3.02.76-.86 2.09-1.48 3.1-1.46zM20.5 17.2c-.55 1.27-.81 1.84-1.52 2.96-.99 1.57-2.39 3.52-4.12 3.53-1.54.01-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.05-1.78-4.04-3.35C-.02 16.9-.34 12.03 1.35 9.5c1.19-1.8 3.07-2.85 4.83-2.85 1.8 0 2.93 1.01 4.42 1.01 1.44 0 2.32-1.01 4.4-1.01 1.57 0 3.23.86 4.42 2.34-3.88 2.13-3.25 7.67 1.08 9.21z" />
          </svg>
          Continue with Apple
        </button>
      )}
    </div>
  );
}
