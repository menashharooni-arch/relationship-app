import { NextRequest, NextResponse } from "next/server";
import { SRC_COOKIE, COOKIE_MAX_AGE, isSignupSource, type SignupSource } from "@/lib/referral";

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
  const path =
    to === "live" ? "/preview"
    : to === "signup" ? "/login?mode=signup"
    : "/cards/new";

  // Resolved against the REQUEST, not NEXT_PUBLIC_APP_URL. Those are the same
  // string on production, and different on every preview deploy and dev box —
  // where this used to bounce the visitor onto production mid-funnel AND throw
  // away the cookie set two lines below, because a Set-Cookie only reaches the
  // origin that sent it. The promise in the comment above ("attribution
  // survives the detour") was only true same-origin. Same pattern as
  // src/proxy.ts and src/app/auth/callback/route.ts.
  const res = NextResponse.redirect(new URL(path, req.url));

  // A PREFETCH IS NOT A CLICK. /preview renders three <Link href="/join?src=preview">,
  // and the App Router prefetches every link in the viewport — including, for
  // reasons of its own, one request with no `src` at all. That param-less
  // prefetch fell through to the "share_info" default and wrote it, so every
  // visitor to the demo page was tagged with a form they never submitted. Then
  // the real click arrived, found a valid-looking source already set, and the
  // rule above ("preview is weak, never overwrite a real source") handed the
  // invented value straight back — so no signup from that page was ever
  // attributed to `preview`.
  //
  // Next-Router-Prefetch is the ONLY header that separates the two: a genuine
  // click sends `RSC: 1` as well, so keying on RSC would drop attribution for
  // everyone. The redirect still happens either way, so prefetch stays useful.
  const isPrefetch = req.headers.get("next-router-prefetch") === "1";
  if (isPrefetch) return res;

  res.cookies.set(SRC_COOKIE, src, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: true,
  });
  return res;
}
