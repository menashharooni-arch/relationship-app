import { NextRequest, NextResponse } from "next/server";
import { REF_COOKIE, SRC_COOKIE, COOKIE_MAX_AGE } from "@/lib/referral";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Referral link: swiftcard.me/r/CODE → remember the code + redirect to signup.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

  const res = NextResponse.redirect(`${APP_URL}/login?mode=signup&ref=1`);
  if (clean) {
    const opts = { maxAge: COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" as const, path: "/", secure: true };
    res.cookies.set(REF_COOKIE, clean, opts);
    res.cookies.set(SRC_COOKIE, "referral", opts);
  }
  return res;
}
