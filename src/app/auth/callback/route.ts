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

    // If a specific redirect was requested (e.g. invite flow), honour it
    if (next) {
      return NextResponse.redirect(new URL(next, origin));
    }

    // Check if user has completed onboarding
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, customization")
        .eq("id", user.id)
        .single();
      if (profile && (profile.customization as { _deleted?: boolean } | null)?._deleted) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/account-deleted", origin));
      }
      if (!profile) {
        return NextResponse.redirect(new URL("/onboarding", origin));
      }
    }
  }

  return NextResponse.redirect(new URL("/dashboard", origin));
}
