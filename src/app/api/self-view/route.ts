import { NextRequest, NextResponse } from "next/server";
import {
  SELF_PASS_COOKIE, SELF_PASS_MAX_AGE_S, decodeSelfPass, encodeSelfPass, selfViewTarget, verifySelfLink,
} from "@/lib/self-pass";

// GET /api/self-view?to=/<slug>&t=<token> — the owner's own "View live".
//
// Marks the browser this lands in as the card owner's (lib/self-pass), then
// sends it to the card at its normal address. In the iPhone app this is the
// only thing that can: the link opens in Safari, which has no session and has
// never been signed in to that account.
//
// Never a dead end: a missing, expired or tampered token just skips the mark,
// and a target that isn't one of our card paths goes to the home page — this
// cannot be used to redirect anywhere else.

export async function GET(req: NextRequest) {
  const to = selfViewTarget(req.nextUrl.searchParams.get("to")) ?? "/";
  const res = NextResponse.redirect(new URL(to, req.url), 303);
  // The token rides in this URL only; it must not be cached or passed on.
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");

  const owner = verifySelfLink(req.nextUrl.searchParams.get("t"));
  if (!owner) return res;
  // Keep any owners this browser already carries (a shared family device),
  // with this one first.
  const existing = decodeSelfPass(req.cookies.get(SELF_PASS_COOKIE)?.value);
  const value = encodeSelfPass([owner, ...existing.filter((id) => id !== owner)]);
  if (value) {
    res.cookies.set(SELF_PASS_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SELF_PASS_MAX_AGE_S,
    });
  }
  return res;
}
