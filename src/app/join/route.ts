import { NextRequest, NextResponse } from "next/server";
import { SRC_COOKIE, COOKIE_MAX_AGE, isSignupSource, type SignupSource } from "@/lib/referral";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Signup entry (no referrer): swiftcard.me/join?src=save_contact → remember the
// source for analytics, then go to the create-account page. No free month —
// only a real /r/CODE referral grants one.
// `to=live` lands on the Test It Live demo (/preview) instead of the signup
// form — used by the "Create Your Free Card" nudges so visitors try it first.
// The source cookie is set either way, so attribution survives the detour.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("src");
  let src: SignupSource = isSignupSource(raw) && raw !== "referral" ? raw : "share_info";
  // "preview" is a weak source (buttons ON the demo page): whatever sent the
  // visitor here — a nudge, or even a real /r/CODE referral — already set the
  // true source. Never let preview overwrite it.
  const existing = req.cookies.get(SRC_COOKIE)?.value;
  if (src === "preview" && isSignupSource(existing)) src = existing;
  const dest = req.nextUrl.searchParams.get("to") === "live" ? `${APP_URL}/preview` : `${APP_URL}/login?mode=signup`;

  const res = NextResponse.redirect(dest);
  res.cookies.set(SRC_COOKIE, src, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: true,
  });
  return res;
}
