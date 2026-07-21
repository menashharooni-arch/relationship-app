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

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/profile/:path*", "/cards/:path*", "/settings/:path*", "/office/:path*", "/contacts/:path*"],
};
