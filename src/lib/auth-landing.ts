import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { reportError } from "@/lib/report-error";
import { safeNextPath } from "@/lib/safe-next";

// ── Where a person goes the moment they are signed in ────────────────────────
// Two doors lead here and must behave identically:
//   • /auth/callback — an OAuth round-trip (Google/Apple) or a PKCE email link
//     (?code=…, exchanged against a verifier this browser holds).
//   • /auth/confirm  — an email link carrying a token_hash (the SwiftCard auth
//     emails), verified server-side with no browser-held verifier.
// They used to be one route with this logic inline; it lives here so the two
// can never drift (a new account going to /onboarding, a deleted one to the
// reopen screen, everyone else to their `next`).

/** A Supabase client for a route handler, writing the session cookies. */
export async function routeSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

/**
 * The link or round-trip did not produce a session. A team invite goes back to
 * its invite page (which explains it and can send a fresh link); anything else
 * to the login form with its "didn't complete" message, keeping `next` so
 * signing in there still finishes the job (a claim=1 draft, a plan pick).
 */
export function authFailedRedirect(origin: string, next: string | null): NextResponse {
  const safeNext = safeNextPath(next);
  if (safeNext && /^\/join\/[^/?#]+$/.test(safeNext)) {
    return NextResponse.redirect(new URL(`${safeNext}?link=expired`, origin));
  }
  const failed = new URL("/login?error=oauth", origin);
  if (safeNext) failed.searchParams.set("next", safeNext);
  return NextResponse.redirect(failed);
}

/**
 * Signed in: route by account state. Only ever called AFTER a successful
 * exchange/verify — never on a failure, or a still-present previous session
 * would silently land the visitor in the OLD account.
 */
export async function landAfterAuth(
  supabase: SupabaseClient,
  opts: { origin: string; next: string | null; intent?: string | null },
): Promise<NextResponse> {
  const { origin } = opts;
  // Only honour a same-origin relative redirect (no open-redirect to other
  // sites). Shared guard — the hand-written version here let "/\evil.com"
  // through, and new URL() below resolves that to https://evil.com/.
  const safeNext = safeNextPath(opts.next);

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, customization")
      .eq("id", user.id)
      .single();
    // A deleted account is always sent to the reopen screen, even with a ?next.
    if (profile && (profile.customization as { _deleted?: boolean } | null)?._deleted) {
      // Keep the session so they can reopen within the grace window.
      return NextResponse.redirect(new URL("/account-deleted", origin));
    }
    if (!profile) {
      // Google (or any OAuth) sign-in did not auto-link to an existing
      // email/password account for this email — Supabase does not
      // guarantee auto-linking (unconfirmed email, linking disabled, an
      // alias/casing mismatch), so this could be a genuinely new user, OR
      // it could silently mint a second, duplicate account sharing one
      // email with an existing one (auth audit — high severity). Blocking
      // signup here on a false positive would actively harm real new
      // users, and profiles.email is NOT a reliable auth-email column in
      // this app (it drifts to a card's public contact address — see
      // account-email.ts) — so this is deliberately alert-only, not a
      // blocking check, until a verified, tested fix can be reviewed.
      if (user.email) {
        try {
          const admin = getAdminSupabase();
          // Only the first page (1000 most recent-created auth users) —
          // this only ever runs once per NEW account (returning users
          // never reach this branch), but paginating further would still
          // add real, ever-growing synchronous latency to every future
          // signup as the user base grows, for a purely diagnostic alert
          // that was never meant to block anything (code review). One
          // page keeps the cost bounded and covers this product's current
          // and near-term scale; revisit if the account base grows large
          // enough that a genuine duplicate could fall outside it.
          const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const dup = data?.users?.find((u) => u.id !== user.id && u.email?.toLowerCase() === user.email!.toLowerCase());
          if (dup) {
            await reportError("auth.callback.possible_duplicate_account", new Error("New OAuth sign-in shares an email with an existing auth user"), {
              newUserId: user.id,
              existingUserId: dup.id,
              email: user.email,
            });
          }
        } catch (e) {
          console.error("[auth/callback] duplicate-account check failed:", e);
        }
      }

      // Brand-new account: preserve a same-origin ?next through onboarding so a
      // guest who signed up mid-edit returns to the editor and their draft is
      // claimed (rather than getting stranded on the dashboard).
      const onboardingUrl = new URL("/onboarding", origin);
      if (safeNext) onboardingUrl.searchParams.set("next", safeNext);
      // A SIGN-IN tap (web Apple sets intent=signin) with no SwiftCard
      // account is bounced to Create account by /onboarding, the same rule
      // the web Google button follows (Task 4).
      if (opts.intent === "signin") onboardingUrl.searchParams.set("intent", "signin");
      return NextResponse.redirect(onboardingUrl);
    }
  }

  if (safeNext) {
    return NextResponse.redirect(new URL(safeNext, origin));
  }
  return NextResponse.redirect(new URL("/dashboard", origin));
}
