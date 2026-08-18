"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { detectNativeApp, useIsNativeApp } from "@/lib/platform";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { safeNextPath } from "@/lib/safe-next";
import { canOpenInDefaultBrowser, openInDefaultBrowser } from "@/lib/external-purchase";

// Auth redirects are pinned to the SwiftCard domain, NOT window.location.origin.
// Origin-based redirects break sign-in if the form is ever loaded on a Vercel
// preview host (Supabase would reject the non-allowlisted redirect and the PKCE
// exchange would fail cross-host). Every login / signup / Google / reset flow
// therefore routes through swiftcard.me.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Kill switch for the Apple button, kept deliberately after the provider went
// live (2026-08-07, NEXT_PUBLIC_APPLE_SIGNIN_ENABLED=1 in Vercel Production).
// It exists so the button can never be visible while Apple sign-in is broken —
// which it will be roughly every 6 months when the Apple client secret expires.
// Set to 0 and redeploy to hide it; a dead sign-in control is an App Review 2.1
// rejection on its own. Read at module scope, not per render, and compared to
// the literal so a stray value can't accidentally switch it on.
const APPLE_SIGNIN_ENABLED = process.env.NEXT_PUBLIC_APPLE_SIGNIN_ENABLED === "1";

export default function LoginForm({
  redirectTo,
  initialMode = "signin",
  signInOnly = false,
}: {
  redirectTo?: string;
  initialMode?: "signin" | "signup";
  /**
   * This form can sign you in, but never create an account.
   *
   * Set by the login page for the iOS shell: accounts are made on the website.
   * Both toggle options still render — the "Create account" side just swaps the
   * card for a message pointing at the site, so the answer sits exactly where
   * someone goes looking for it.
   *
   * Passed down from a SERVER-rendered value rather than read from
   * useIsNativeApp() here, because that hook is false on the first render —
   * gating on it would paint a real signup form for one frame before replacing
   * it.
   */
  signInOnly?: boolean;
}) {
  // No signInOnly override here any more: the app's toggle must be able to
  // REACH signup mode, because that is what shows the message.
  //
  // In the app this always starts at "signin" regardless — the login page
  // resolves ?mode=signup to "signin" before it ever gets here, so a deep link
  // opens on the sign-in tab and the message is one tap away. Honouring the
  // deep link straight to the message would work too, but the page heading is
  // server-rendered from the same value and would then read "Create your
  // account" above a card saying accounts are made elsewhere.
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);

  /** In the app, "Create account" shows a message instead of a signup form. */
  const signupRedirect = signInOnly && mode === "signup";

  /**
   * Open swiftcard.me in the DEFAULT BROWSER.
   *
   * A plain link cannot work here: swiftcard.me IS in capacitor.config's
   * allowNavigation, so the shell loads it in the app's own webview — where
   * sc-boot redirects "/" back to /dashboard, i.e. straight back to this login
   * screen for a signed-out visitor.
   *
   * ⚠️ This used to call @capacitor/browser, and THAT IS WHAT GOT 1.0.0 (7)
   * REJECTED under Guideline 3.1.1 a second time. @capacitor/browser opens an
   * SFSafariViewController — an in-app sheet that merely looks like Safari.
   * `detectNativeApp()` is false inside it (no webkit.messageHandlers.bridge),
   * so the native guards on /pricing and /upgrade switch off and the reviewer
   * reached the $4.99 plan and Stripe checkout without ever leaving the app.
   * Apple's screenshot was precisely that sheet.
   *
   * Only UIApplication.open — the native ExternalPurchase plugin — reaches the
   * default browser, which is what the US-storefront allowance in 3.1.1(a)
   * actually permits. See lib/external-purchase.ts. Never route this through an
   * in-app browser again.
   */
  async function openSite(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!detectNativeApp()) return; // web: let the browser follow the href
    e.preventDefault();
    // No fallback on purpose. If this returns false the app stays put rather
    // than opening a selling surface inside the webview — and the link is not
    // rendered as a link at all in that case (see canLeaveApp below).
    await openInDefaultBrowser("/");
  }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  // A failed email/password sign-in: Supabase can't reveal whether the email
  // has no account or the password was wrong (by design), so we surface an
  // honest "create one if you're new" affordance rather than a false claim.
  const [signinFailed, setSigninFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Focused when "Forgot password?" is tapped with the field empty — see
  // handleForgot. Pointing at the box beats an error that blames the user for
  // not having filled in a field they were never asked to fill in.
  const emailRef = useRef<HTMLInputElement>(null);
  const native = useIsNativeApp();

  // Can this build actually leave the app? Resolved after mount because the
  // plugin lives on window.Capacitor, which is absent during SSR. Any shell
  // older than the one carrying ExternalPurchasePlugin resolves false, and the
  // "SwiftCard.me" link then renders as PLAIN TEXT rather than something that
  // would open the marketing site — and its checkout — inside the app.
  const [canLeaveApp, setCanLeaveApp] = useState(false);
  useEffect(() => {
    setCanLeaveApp(canOpenInDefaultBrowser());
  }, []);

  // Surface a failed OAuth round-trip (auth/callback redirects here with
  // ?error=oauth) or a sign-in attempt for an email with no account
  // (?error=no_account) instead of silently landing the visitor back on the
  // form. Read after mount — reading the URL during render would mismatch SSR.
  useEffect(() => {
    let msg = "";
    let toSignup = false;
    try {
      const err = new URLSearchParams(window.location.search).get("error");
      if (err === "oauth") {
        msg = "Google sign-in didn't complete — please try again.";
      } else if (err === "no_account") {
        // They tried to SIGN IN with Google but have no SwiftCard account yet —
        // flip to Create-account and tell them so, instead of leaving them
        // confused on the sign-in tab (Task 4).
        msg = "You don't have an account yet — create one to get started.";
        toSignup = true;
      }
    } catch { /* ignore */ }
    // One-time reads of the URL after mount (SSR-safe): applying them is the
    // whole point of this effect.
    /* eslint-disable react-hooks/set-state-in-effect -- one-time post-mount URL read */
    if (msg) setErrorMsg(msg);
    if (toSignup) setMode("signup");
    /* eslint-enable react-hooks/set-state-in-effect */
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
    // NATIVE: OAuth must run in the SYSTEM browser (SFSafariViewController) —
    // Google blocks embedded-webview OAuth (403 disallowed_useragent). The
    // round-trip returns via the swiftcard:// scheme and NativeAppBridge
    // completes the session in the webview. See src/lib/native-auth.ts.
    if (native) {
      const { startNativeOAuth } = await import("@/lib/native-auth");
      const err = await startNativeOAuth(supabase, "google", redirectTo, mode);
      if (err) { setErrorMsg(err); setStatus("error"); }
      return;
    }
    // Carry a same-origin `next` (e.g. the guest editor) through the OAuth
    // round-trip so the callback can return the user to where they left off.
    const safeNext = safeNextPath(redirectTo);
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
  // The Supabase provider went live 2026-08-07, so this is a real sign-in path
  // now. The error handling stays: the client secret is an Apple-signed JWT that
  // expires every 6 months (next ≈ 2027-02-05), and when it lapses Supabase
  // starts answering "provider is not enabled" again — better a readable message
  // than a thrown promise. See app-store/RELEASE_CHECKLIST.md §B to regenerate.
  async function handleApple() {
    if (mode === "signup") await clearExistingSession();
    try {
      // Same system-browser flow as native Google — consistent, and avoids
      // running Apple's auth page inside the embedded webview.
      const { startNativeOAuth } = await import("@/lib/native-auth");
      const err = await startNativeOAuth(supabase, "apple", redirectTo, mode);
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
        if (error.message === "Invalid login credentials") {
          // Could be a wrong password OR no account — Supabase won't say which.
          // Guide them to Create-account without a false "no account" claim.
          setErrorMsg("We couldn't sign you in. If you don't have an account yet, create one — it's free.");
          setSigninFailed(true);
        } else {
          setErrorMsg(error.message);
        }
        setStatus("error");
      } else {
        // safeNextPath, NOT the raw redirectTo — `next` is attacker-controlled
        // (see the helper). This line was the one place the guard was missed.
        window.location.href = safeNextPath(redirectTo) ?? "/dashboard";
      }
    } else {
      await clearExistingSession();
      // Carry a same-origin `next` (e.g. a team invite, or the guest editor)
      // through email-confirmation too — mirrors handleGoogle/handleApple.
      // Without this, a signup with confirmation enabled sends the user to
      // /auth/callback with no `next` once they click the emailed link, so
      // e.g. an invited employee never returns to /join/<token> to accept
      // (auth audit — the invite was silently dropped).
      const safeNext = safeNextPath(redirectTo);
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
      // Point at the field instead of scolding. Someone who taps this is
      // already locked out; answering with a red error for a box nobody asked
      // them to fill is the wrong tone AND the wrong instruction. Focusing it
      // puts the cursor where the next action is and says what to do.
      setErrorMsg("Enter your email above and tap Forgot password again.");
      setStatus("idle");
      emailRef.current?.focus();
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
      {/* Mode toggle — both options, on web AND in the app. In the app the
          "Create account" side does not open a signup form: it swaps the whole
          card for a message pointing at the website (see signupRedirect below).
          The toggle stays so the answer is discoverable exactly where someone
          looks for it, instead of the option silently not existing. */}
      <div className="flex bg-[#EDE8E0] border border-[#E4DDD4] rounded-full p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setStatus("idle"); setErrorMsg(""); setSigninFailed(false); }}
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

      {/* THE APP'S "Create account": a message, and nothing else.
          Returning early replaces the entire rest of the card — form, submit,
          forgot-password, the divider and both OAuth buttons — so there is no
          path to an account here, not even an OAuth one. */}
      {signupRedirect ? (
        <p className="py-6 text-center text-base leading-relaxed text-slate-600">
          Ready to grow your network? Join us at{" "}
          {/* FAIL CLOSED. In a shell that cannot reach the default browser this
              is deliberately not a link: no tap target beats a tap target that
              opens a selling surface inside the app (Guideline 3.1.1). The
              address is still readable, so it can be typed into Safari. */}
          {native && !canLeaveApp ? (
            <span className="font-semibold text-slate-900">SwiftCard.me</span>
          ) : (
            <a
              href={APP_URL}
              onClick={openSite}
              className="font-semibold text-[#1D4ED8] underline underline-offset-2 hover:text-[#1740C4]"
            >
              SwiftCard.me
            </a>
          )}
          .
        </p>
      ) : (
      <>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Labelled fields with real autofill hints.
            The inputs were unlabelled, unnamed placeholders with no autoComplete,
            so password managers had nothing to bind to — you had to type your
            credentials by hand every time, which is the single loudest "this is
            not a real product" signal an auth screen can send. A placeholder is
            also not a label: it disappears the moment you type, leaving a filled
            box with no idea what it holds, and screen readers get nothing.
            sc-input is the app's own focus treatment (globals.css) — these were
            hand-rolling a border change and skipping the ring. */}
        <div className="space-y-1.5">
          <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-600">
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="you@company.com"
            required
            ref={emailRef}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="sc-input w-full bg-white border border-[#E4DDD4] text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-600">
              Password
            </label>
            {/* Where every real platform puts it, and only on the tab where it
                means anything. It used to sit under the OAuth buttons as 12px
                slate-400 on the warm card — roughly 2:1 contrast, below the
                submit button, for the one control someone locked out needs to
                find first. */}
            {mode === "signin" && (
              <button
                type="button"
                onClick={handleForgot}
                disabled={status === "loading"}
                className="text-xs font-semibold text-[#1D4ED8] hover:text-[#1740C4] hover:underline underline-offset-2 disabled:opacity-50 transition-colors"
              >
                {status === "loading" ? "Sending…" : "Forgot password?"}
              </button>
            )}
          </div>
          <div className="relative">
            <input
              id="auth-password"
              name="password"
              type={showPassword ? "text" : "password"}
              // current-password vs new-password decides whether the browser
              // offers to FILL or to GENERATE — getting it wrong makes managers
              // behave strangely on the tab you are actually on.
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="sc-input w-full bg-white border border-[#E4DDD4] text-slate-900 placeholder-slate-400 rounded-xl pl-4 pr-12 py-3 text-sm"
            />
            {/* Typing a password blind on a phone keyboard is where sign-ins
                get abandoned. Not rendered when the field is empty so it never
                sits there as a dead control. */}
            {password.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-500 hover:text-slate-800 transition-colors"
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} style={{ width: 18, height: 18 }} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <p className="text-red-400 text-xs text-center">{errorMsg}</p>
        )}

        {/* After a failed sign-in, a one-tap path to Create-account (keeps the
            email they typed) — the "redirect to create account" affordance for
            the email/password case, where Supabase can't confirm no-account. */}
        {mode === "signin" && signinFailed && !signInOnly && (
          <button
            type="button"
            onClick={() => { setMode("signup"); setSigninFailed(false); setErrorMsg(""); setStatus("idle"); }}
            className="w-full text-center text-[#1D4ED8] hover:text-[#1740C4] font-semibold text-sm py-1 transition-colors"
          >
            Create an account →
          </button>
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
      {/* ⚠️ On native, Google is gated on APPLE_SIGNIN_ENABLED too. Guideline
          4.8 is about the *combination*: offering a third-party social login
          in-app obliges an equivalent private option. Hiding only the Apple
          button when the provider breaks would leave Google standing alone —
          turning a kill switch meant to prevent a 2.1 into a guaranteed 4.8 on
          the next submission. With both hidden, native falls back to
          email/password, which owes Apple nothing. Web is unaffected. */}
      {native ? (
        APPLE_SIGNIN_ENABLED && (
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
        )
      ) : (
        <GoogleSignInButton redirectTo={redirectTo} oneTap intent={mode} />
      )}

      {/* Native app only: Sign in with Apple (Apple requires it alongside other
          social logins in-app). Renders nothing on web.

          Also gated on APPLE_SIGNIN_ENABLED. This used to render on platform
          alone, while the Supabase Apple provider was not enabled on the
          project — so every tap failed with an error toast, next to a Google
          button that worked. A permanently dead sign-in control is an App
          Review 2.1 rejection on its own, and Apple's own 4.8 rule is about
          OFFERING Sign in with Apple, which a button that cannot sign anyone
          in does not do.

          Same shape as the Wallet/APNs gates: inert until configured. Enable
          the provider in Supabase, then set NEXT_PUBLIC_APPLE_SIGNIN_ENABLED=1
          in Vercel and REDEPLOY — env changes only take effect on a new build.
          Until then, hidden beats broken. */}
      {native && APPLE_SIGNIN_ENABLED && (
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

      </>
      )}
    </div>
  );
}
