import { NextRequest, NextResponse } from "next/server";
import { REF_COOKIE, SRC_COOKIE, COOKIE_MAX_AGE } from "@/lib/referral";
import { getAdminSupabase } from "@/lib/supabase-admin";

// Referral link: swiftcard.me/r/CODE → remember the code + redirect to signup.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
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
    //
    // Resolved against the REQUEST, not NEXT_PUBLIC_APP_URL: identical on
    // production, but on a preview deploy or a dev box the build-time constant
    // sent the visitor to production — discarding the referral code and source
    // cookies set just below, since a Set-Cookie only reaches the origin that
    // sent it. That is the referrer losing credit, silently, in exactly the
    // environments used to test the referral link.
    new URL(`/login?mode=signup${resolved ? "&ref=1" : ""}`, req.url),
  );

  // Same guard as /join: a prefetched <Link> must not spend a referral. No
  // in-app link points here today (these arrive as a friend's shared URL, a
  // real navigation), but the cookie write and the referral lookup above are
  // both things a prefetch has no business triggering.
  if (req.headers.get("next-router-prefetch") === "1") return res;

  if (resolved) {
    const opts = { maxAge: COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" as const, path: "/", secure: true };
    res.cookies.set(REF_COOKIE, clean, opts);
    res.cookies.set(SRC_COOKIE, "referral", opts);
  }
  return res;
}
