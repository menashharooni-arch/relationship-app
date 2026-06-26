import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

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

    await supabase.auth.exchangeCodeForSession(code);

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
        return NextResponse.redirect(new URL("/onboarding", origin));
      }
    }

    if (safeNext) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  return NextResponse.redirect(new URL("/dashboard", origin));
}
