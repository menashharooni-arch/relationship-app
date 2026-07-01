import { NextRequest, NextResponse } from "next/server";
import { SRC_COOKIE, COOKIE_MAX_AGE, isSignupSource } from "@/lib/referral";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Signup entry (no referrer): swiftcard.me/join?src=save_contact → remember the
// source for analytics, then go to the create-account page. No free month —
// only a real /r/CODE referral grants one.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("src");
  const src = isSignupSource(raw) && raw !== "referral" ? raw : "share_info";

  const res = NextResponse.redirect(`${APP_URL}/login?mode=signup`);
  res.cookies.set(SRC_COOKIE, src, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: true,
  });
  return res;
}
