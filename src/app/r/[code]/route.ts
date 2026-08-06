import { NextRequest, NextResponse } from "next/server";
import { REF_COOKIE, SRC_COOKIE, COOKIE_MAX_AGE } from "@/lib/referral";
import { getAdminSupabase } from "@/lib/supabase-admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Referral link: swiftcard.me/r/CODE → remember the code + redirect to signup.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

  // RESOLVE the code before asserting anything about it. This sanitized the
  // string and then set source=referral unconditionally, never checking that a
  // referrer existed — unlike /join, which refuses to claim a referral source
  // it cannot back up.
  //
  // So a truncated or mangled link (a wrapped URL in an email, a mistyped code)
  // silently stripped the referrer of credit while the friend still got their
  // free month, and the admin panels then disagreed with each other:
  // "Signups by source" counted a referral that "Successful referrals" had
  // never heard of, with nothing to explain the gap.
  let resolved = false;
  if (clean) {
    try {
      const { data } = await getAdminSupabase()
        .from("profiles")
        .select("id")
        .eq("referral_code", clean)
        .maybeSingle();
      resolved = !!data;
    } catch {
      // A lookup failure must not break the link. Fall through as unresolved —
      // the visitor still reaches signup, attributed as direct. Losing an
      // attribution is better than inventing one.
    }
  }

  const res = NextResponse.redirect(
    // ?ref=1 drives the "your friend gave you a free month" headline. Only
    // promise that when there is a referrer to honour it.
    `${APP_URL}/login?mode=signup${resolved ? "&ref=1" : ""}`,
  );

  if (resolved) {
    const opts = { maxAge: COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" as const, path: "/", secure: true };
    res.cookies.set(REF_COOKIE, clean, opts);
    res.cookies.set(SRC_COOKIE, "referral", opts);
  }
  return res;
}
