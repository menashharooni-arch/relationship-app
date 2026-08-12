import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { touchWalletPass } from "@/lib/wallet-registry";

// The safety net for pass updates.
//
// A card's appearance is reachable from more places than it is practical to
// hook: the card editor, the office branding seed, a profile photo swap, a
// plan change that re-templates a custom card. Hooking each one is how you end
// up with the one path nobody remembered, and a pass that never updates for
// reasons no one can see.
//
// So there is exactly one hot hook (the card editor, where almost every change
// happens and where the update should feel immediate) and this sweep, which
// re-fingerprints every pass anyone actually holds and catches the rest within
// the day. touchWalletPass writes and pushes nothing when nothing changed, so
// a sweep over unchanged cards costs a hash each and wakes no one.

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  // The env var must exist AND match — with it unset, `Bearer undefined` would
  // otherwise be a valid credential for anyone who guessed it.
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getAdminSupabase();
  // Only passes with a live registration. A pass nobody holds has nobody to
  // notify, and re-rendering every card in the database to discover that would
  // be the most expensive no-op in the product.
  const { data: regs, error } = await admin.from("wallet_registrations").select("serial");
  if (error) {
    console.error("[wallet] sweep could not read registrations:", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const serials = [...new Set((regs ?? []).map((r) => r.serial as string))];
  const counts = { checked: 0, updated: 0, gone: 0, failed: 0 };

  for (const serial of serials) {
    counts.checked++;
    try {
      const result = await touchWalletPass(serial);
      if (result === "updated") counts.updated++;
      if (result === "gone") counts.gone++;
    } catch (e) {
      counts.failed++;
      // One bad card must not end the sweep for every other card behind it.
      console.error(`[wallet] sweep failed for ${serial}:`, e);
    }
  }

  return NextResponse.json(counts);
}
