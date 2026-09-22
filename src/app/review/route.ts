import { NextRequest, NextResponse } from "next/server";
import { APP_STORE_WRITE_REVIEW_URL } from "@/lib/app-store";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isLikelyBot } from "@/lib/bot-detection";

// swiftcard.me/review → the App Store review form. A short, stable address for
// emails, texts and QR codes, so the numeric App Store id never has to be
// pasted anywhere outside lib/app-store.ts.
//
// Temporary redirect, not 308: a permanent one gets cached by browsers and mail
// scanners and this route would stop being counted. Each real visit is logged
// as cta_clicked { cta: "rate_us", placement: "review_link" } in product_events
// — the same row the on-site buttons write via lib/events.ts, so
// /admin/analytics shows all of them under one "rate_us" CTA.
export async function GET(req: NextRequest) {
  // No listing yet: the home page is the only honest answer.
  if (!APP_STORE_WRITE_REVIEW_URL) return NextResponse.redirect(new URL("/", req.url), 307);

  const res = NextResponse.redirect(APP_STORE_WRITE_REVIEW_URL, 307);
  // A prefetched <Link> and a link-scanning mail server are not people.
  if (req.headers.get("next-router-prefetch") === "1" || isLikelyBot(req.headers.get("user-agent"))) return res;

  try {
    await getAdminSupabase().from("product_events").insert({
      name: "cta_clicked",
      props: { cta: "rate_us", placement: "review_link" },
      path: "/review",
      is_internal: process.env.VERCEL_ENV !== "production",
    });
  } catch {
    // Counting the tap must never stand between a person and the review form.
  }
  return res;
}
