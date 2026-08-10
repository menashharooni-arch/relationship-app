import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Any redirect below must carry the auth cookies just written onto
  // supabaseResponse (e.g. a rotated refresh token from the getUser() call
  // above) — a bare NextResponse.redirect() is a fresh response object that
  // doesn't inherit them, silently discarding a token rotation and desyncing
  // the browser's session (auth audit).
  function redirectWithAuthCookies(url: URL): NextResponse {
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  }

  // The native shell must never land on the marketing homepage — "/" is the
  // app. A hero, a "Get started free" CTA and a footer of site links is the
  // wrong first screen for something you just installed, and it is the shape
  // App Review reads as a repackaged website (guideline 4.2).
  //
  // Keyed on two shell-only signals, so the WEBSITE at "/" is completely
  // untouched: the user-agent suffix future builds append (appendUserAgent in
  // capacitor.config.ts), and the `sc_shell` cookie the sc-boot script plants
  // the first time it detects the shell — which is what makes this live for
  // builds already installed, whose UA carries no token. First-ever launch
  // still falls back to sc-boot's client-side redirect (and plants the
  // cookie); every launch after that is redirected here, before any homepage
  // HTML is sent — one navigation instead of two, no hidden-page gap. Placed
  // after getUser() so it can branch on the real session — a signed-out user
  // goes straight to /login rather than bouncing through /dashboard's guard.
  if (
    request.nextUrl.pathname === "/" &&
    ((request.headers.get("user-agent") ?? "").includes("SwiftCardApp") ||
      request.cookies.get("sc_shell")?.value === "1")
  ) {
    return redirectWithAuthCookies(new URL(user ? "/dashboard" : "/login", request.url));
  }

  // NOTE: /templates is deliberately NOT here. The marketing nav and footer
  // both link to it, so gating it bounced every signed-out visitor to /login
  // the moment they clicked "Templates" — it's a gallery of designs with
  // sample data and makes no authenticated calls.
  const protectedPaths = ["/dashboard", "/onboarding", "/profile", "/cards", "/settings", "/office", "/contacts"];
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  // Guest card builder: /cards/new is deliberately open with NO login wall — a
  // guest builds a full card here and is only gated on protected actions
  // (publish/save/share) inside the wizard. Every other /cards/* route (e.g.
  // editing an existing card) still requires auth. Signed-in users fall through
  // to the deleted-account check below like any other protected page.
  const isGuestCardBuilder =
    request.nextUrl.pathname === "/cards/new" ||
    request.nextUrl.pathname.startsWith("/cards/new/");

  if (!user && isProtected && !isGuestCardBuilder) {
    return redirectWithAuthCookies(new URL("/login", request.url));
  }

  // A soft-deleted account's Supabase session/access-token stays valid for its
  // remaining lifetime (signOut only revokes the refresh token) — without this,
  // that live token could keep loading/editing a "deleted" account's pages for
  // up to an hour after deletion, contradicting the account-deleted messaging.
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("customization")
      .eq("id", user.id)
      .maybeSingle();
    const deleted = (profile?.customization as Record<string, unknown> | null)?._deleted === true;
    if (deleted) {
      return redirectWithAuthCookies(new URL("/account-deleted", request.url));
    }
  }

  return supabaseResponse;
}

// Every AUTHENTICATED prefix has to be here, not just the obvious seven.
// Supabase rotates the refresh token when a Server Component refreshes the
// session, and only this proxy can persist the rotated cookies back to the
// browser. On a route it doesn't cover, the rotation happens and the new
// cookies are dropped — so once the old token falls outside Supabase's reuse
// grace window the user is silently signed out mid-session. Intermittent by
// nature, and near-impossible to reproduce on demand, which is why /admin,
// /grow, /welcome, /upgrade, /checkout/success and /join/[token] went
// unnoticed.
//
// This list does NOT gate anything. The login wall is `protectedPaths` above,
// which is unchanged — so /join/[token] (opened by signed-OUT invitees),
// /welcome, /upgrade and /checkout/success stay reachable exactly as before.
// The only effect of being here is that a rotated session cookie survives.
//
// /account-deleted is deliberately EXCLUDED: the proxy redirects there, and
// including it would mean the redirect target re-enters the same check.
export const config = {
  matcher: [
    // Exact "/" only (no :path*), for the native-shell redirect above. On the
    // website this just means the homepage also gets a session refresh, which
    // is harmless — it renders identically signed in or out.
    "/",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/profile/:path*",
    "/cards/:path*",
    "/settings/:path*",
    "/office/:path*",
    "/contacts/:path*",
    "/admin/:path*",
    "/grow/:path*",
    "/welcome/:path*",
    "/upgrade/:path*",
    "/checkout/:path*",
    "/join/:path*",
    "/share/:path*",
  ],
};
