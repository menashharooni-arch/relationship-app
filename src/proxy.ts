import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── SITE LOCKDOWN ────────────────────────────────────────────────────────────
// While true, the whole site requires a logged-in account EXCEPT the paths in
// PUBLIC_* below (auth pages, shared card/link pages, legal pages). This hides
// the marketing site and the product from anyone without an account.
//
// TO REOPEN THE SITE PUBLICLY: either set the env var SITE_PUBLIC=1 in Vercel
// (takes effect on next deploy, no code change) OR flip this constant to false
// and redeploy.
const LOCKDOWN = process.env.SITE_PUBLIC !== "1";

// Reachable without logging in even during lockdown.
const PUBLIC_EXACT = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/account-deleted",
  "/privacy",
  "/terms",
  "/contact",
]);
// Prefix matches (trailing slash so "/card/" can't also match "/cards").
// /join/ = office invite acceptance (token-gated, so safe during lockdown —
// an invited teammate can still accept and get an account).
const PUBLIC_PREFIXES = ["/auth/", "/card/", "/links/", "/r/", "/join/", "/.well-known/"];

function isPublicPath(path: string): boolean {
  if (PUBLIC_EXACT.has(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

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

  const path = request.nextUrl.pathname;

  // Site-wide lockdown: an unauthenticated visitor to anything that isn't an
  // auth page, a shared card/link, or a legal page is sent to /login. This is
  // what keeps the product/marketing site hidden from people without accounts.
  if (LOCKDOWN && !user && !isPublicPath(path)) {
    return redirectWithAuthCookies(new URL("/login", request.url));
  }

  const protectedPaths = ["/dashboard", "/onboarding", "/profile", "/templates", "/cards", "/settings", "/office", "/contacts"];
  const isProtected = protectedPaths.some((p) => path.startsWith(p));

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

export const config = {
  // Run on every page navigation EXCEPT API routes, Next internals, and static
  // files (anything with a file extension). The lockdown check above then
  // decides what an unauthenticated visitor may see. API routes keep their own
  // per-route authorization; shared-card assets (OG images, sitemap, robots)
  // sit under /api or carry a file extension and are served normally.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
