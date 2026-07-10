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

  const protectedPaths = ["/dashboard", "/onboarding", "/profile", "/templates", "/cards", "/settings", "/office", "/contacts"];
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
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
      return NextResponse.redirect(new URL("/account-deleted", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/profile/:path*", "/templates/:path*", "/cards/:path*", "/settings/:path*", "/office/:path*", "/contacts/:path*"],
};
