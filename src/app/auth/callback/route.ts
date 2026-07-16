import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { reportError } from "@/lib/report-error";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // A visitor who cancels/denies on Google's screen comes back with an
  // `error` param and no code. Without this branch they fell through to
  // /dashboard, which (having no session) bounced them to /login with no
  // explanation — a confusing double-redirect. Send them straight to the
  // login form's existing "didn't complete" message instead.
  if (!code && searchParams.get("error")) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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

    // CRITICAL: if the exchange fails we must NOT fall through to getUser() —
    // a still-present previous session would silently log the visitor into the
    // OLD account (looks like their brand-new Google email "linked" to it).
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("[auth/callback] code exchange failed:", exchangeError.message);
      return NextResponse.redirect(new URL("/login?error=oauth", origin));
    }

    // Only honour a same-origin relative redirect (no open-redirect to other sites).
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

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
        return NextResponse.redirect(onboardingUrl);
      }
    }

    if (safeNext) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  return NextResponse.redirect(new URL("/dashboard", origin));
}
