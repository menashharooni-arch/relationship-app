"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { loadGoogleIdentity } from "@/lib/google-gis";
import { detectNativeApp } from "@/lib/platform";

// ── Web-only Google sign-in via Google Identity Services (GIS) ──────────────
// Renders Google's official "Sign in with Google" button and exchanges the
// returned ID token for a Supabase session with signInWithIdToken. This avoids
// the OAuth *redirect* flow, so Google's account chooser shows THIS app's
// domain (via the client ID's authorized origins) instead of the raw
// *.supabase.co project domain.
//
// NOT for native: the Capacitor iOS shell keeps its own Google flow. LoginForm
// only renders this on web (native === false).
//
// Post-login: on success we route through /onboarding, reusing the app's
// EXISTING post-login logic — onboarding is idempotent (existing profile →
// forwards to `next`/dashboard; new user → provisions the profile + referral,
// then forwards). No second onboarding/profile system is introduced.

type Props = {
  // Same-origin continuation (invite token, draft, plan, checkout, next…). Passed
  // straight through to /onboarding so every continuation the password/OAuth
  // flows preserve is preserved here too.
  redirectTo?: string;
  // Rendered fallback label matching the app's existing button copy.
  className?: string;
  /** Also show Google One Tap (the floating account chip): a returning user
   *  signs in with a single tap without finding the button. Login page only —
   *  anywhere account choice must be explicit (the guest gate) leaves it off.
   *  auto_select stays false on purpose: zero-click auto sign-in would violate
   *  the "visitor explicitly picks an account" rule of the guest card flow. */
  oneTap?: boolean;
};

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type Phase = "loading" | "ready" | "authenticating" | "error";

export default function GoogleSignInButton({ redirectTo, className, oneTap = false }: Props) {
  const btnRef = useRef<HTMLDivElement>(null);
  // A missing client ID is known at first render (build-time NEXT_PUBLIC var),
  // so start in the right state instead of setState-ing inside the effect.
  const [phase, setPhase] = useState<Phase>(() => (CLIENT_ID ? "loading" : "error"));
  const [errorMsg, setErrorMsg] = useState(() =>
    CLIENT_ID ? "" : "Google sign-in isn't configured. Use email, or try again later."
  );
  // Guards against a second credential callback running while one is already
  // in flight (double-click, One Tap + button both firing).
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // Defense-in-depth: never load or init GIS inside the native Capacitor
    // shell, even if this briefly mounts before useIsNativeApp() flips in the
    // parent (detectNativeApp() reads window.Capacitor and is accurate
    // immediately on the client). Native keeps its own Google flow.
    if (detectNativeApp()) return;

    // Missing client ID is already reflected in the initial phase above.
    if (!CLIENT_ID) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const safeNext =
      redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : null;

    async function handleCredential(resp: { credential?: string }) {
      if (inFlight.current) return; // never run the exchange twice
      if (!resp?.credential) {
        setPhase("error");
        setErrorMsg("Google didn't return a sign-in token — please try again.");
        return;
      }
      inFlight.current = true;
      setPhase("authenticating");
      setErrorMsg("");
      try {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: resp.credential,
        });
        if (error) {
          inFlight.current = false;
          setPhase("error");
          // Surface a plain message; the raw token never gets logged.
          setErrorMsg(
            /audience|client/i.test(error.message)
              ? "Google sign-in isn't fully set up yet. Please use email for now."
              : "We couldn't finish signing you in with Google. Please try again."
          );
          return;
        }
        // Session created. Reuse the existing post-login path (idempotent for
        // both brand-new and returning users). A full navigation ensures the
        // new auth cookies are sent on the next request.
        window.location.href = safeNext
          ? `/onboarding?next=${encodeURIComponent(safeNext)}`
          : "/onboarding";
      } catch {
        inFlight.current = false;
        setPhase("error");
        setErrorMsg("Network error signing in with Google — please try again.");
      }
    }

    loadGoogleIdentity()
      .then((googleId) => {
        if (cancelled) return;
        googleId.initialize({
          client_id: CLIENT_ID!,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
        });
        if (btnRef.current) {
          btnRef.current.replaceChildren(); // clear any prior render (no innerHTML)
          googleId.renderButton(btnRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "pill",
            logo_alignment: "center",
            width: 320,
          });
        }
        // One Tap: surfaces the returning user's Google account as a floating
        // chip (FedCM UI) — one tap signs them in via the SAME handleCredential
        // as the button, whose inFlight guard already covers both firing.
        // Failures are silent by design: the rendered button is always there.
        if (oneTap) {
          try { googleId.prompt(); } catch { /* chip is best-effort */ }
        }
        setPhase("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPhase("error");
        setErrorMsg("Couldn't load Google sign-in. Check your connection and try again.");
      });

    return () => { cancelled = true; };
  }, [redirectTo, oneTap]);

  return (
    <div className={className}>
      {/* Warm up Google's origin the moment this renders — cuts the GIS script
          fetch (the "Loading Google…" gap) by a round-trip. React hoists these
          into <head>. */}
      <link rel="preconnect" href="https://accounts.google.com" />
      <link rel="dns-prefetch" href="https://accounts.google.com" />
      {/* Google's official rendered button (branding-compliant). Hidden until
          ready so we don't flash an empty box. */}
      <div ref={btnRef} className={`flex justify-center ${phase === "ready" ? "" : "hidden"}`} aria-hidden={phase !== "ready"} />

      {phase === "loading" && (
        <div className="w-full flex items-center justify-center gap-3 bg-white text-gray-400 font-semibold py-3 px-6 rounded-full text-sm border border-[#E4DDD4]">
          Loading Google…
        </div>
      )}

      {phase === "authenticating" && (
        <div className="w-full flex items-center justify-center gap-3 bg-white text-gray-500 font-semibold py-3 px-6 rounded-full text-sm border border-[#E4DDD4]">
          Signing you in…
        </div>
      )}

      {phase === "error" && (
        <p className="text-red-400 text-xs text-center mt-1">{errorMsg}</p>
      )}
    </div>
  );
}
