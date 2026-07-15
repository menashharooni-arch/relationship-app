import { NextRequest, NextResponse } from "next/server";
import { SRC_COOKIE, COOKIE_MAX_AGE, isSignupSource, type SignupSource } from "@/lib/referral";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Signup entry (no referrer): swiftcard.me/join?src=save_contact → remember the
// source for analytics, then start them building. No free month — only a real
// /r/CODE referral grants one.
//
// The default destination is the CARD BUILDER, not the signup form. Every caller
// of this route is a "make your own card" invitation — the buttons on the live
// demo, and the footer of every follow-up email/text we send — i.e. the most
// engaged, highest-intent visitors we have. Sending them to a login form asked
// them to open an account before they'd seen a thing they'd made, while every
// other CTA on the site (nav, hero, footer, pricing) drops straight into
// /cards/new with no wall. That inconsistency taxed exactly the wrong people.
// The builder gates on auth itself, at save — which is the right moment.
//
// `to=live` still lands on the Test It Live demo (/preview) instead.
// The source cookie is set either way, so attribution survives the detour.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("src");
  let src: SignupSource = isSignupSource(raw) && raw !== "referral" ? raw : "share_info";
  // "preview" is a weak source (buttons ON the demo page): whatever sent the
  // visitor here — a nudge, or even a real /r/CODE referral — already set the
  // true source. Never let preview overwrite it.
  const existing = req.cookies.get(SRC_COOKIE)?.value;
  if (src === "preview" && isSignupSource(existing)) src = existing;
  const to = req.nextUrl.searchParams.get("to");
  const dest =
    to === "live" ? `${APP_URL}/preview`
    : to === "signup" ? `${APP_URL}/login?mode=signup`
    : `${APP_URL}/cards/new`;

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
