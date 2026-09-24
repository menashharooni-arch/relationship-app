import { NextResponse } from "next/server";
import { VISITOR_COOKIE } from "@/lib/visit-identity";

// Forget this browser's visitor identity (the httpOnly sc_vid cookie).
//
// Card views are keyed on sc_vid, and a contact's device binding is keyed on
// it too. It outlived sign-out, so on a shared phone the NEXT person's views
// of a card were credited to the previous person's contact — "Priya is back"
// when it wasn't Priya (isolation audit 2026-09-24). Called on sign-out and on
// an account switch. Only ever removes this browser's own cookie.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(VISITOR_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
