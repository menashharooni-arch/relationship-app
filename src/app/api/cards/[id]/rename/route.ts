import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { normalizeSlug } from "@/lib/username";
import { isReservedSlug } from "@/lib/slug";

// POST /api/cards/[id]/rename { slug }
// Changes a card's public URL slug and atomically migrates every row keyed by
// the old slug (views, SwiftLink views, events, leads, analytics, per-card
// notifications) to the new one — via the rename_card_slug Postgres function,
// which enforces ownership + uniqueness and runs the whole move in a single
// transaction. Old shared links / QR codes / Wallet passes point at the old
// slug and will stop resolving — the UI warns about this before calling.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const slug = normalizeSlug(String(body?.slug ?? ""));
  if (!slug) {
    return NextResponse.json({ error: "Enter a URL made of letters, numbers, and dashes." }, { status: 400 });
  }

  // Card pages live at the ROOT (2026-08-19), so an app-route name would make
  // the card unreachable. The DB function only checks uniqueness; reserved
  // names are an app concept and are refused here.
  if (isReservedSlug(slug)) {
    return NextResponse.json({ error: "That URL is reserved — try another." }, { status: 409 });
  }

  // The function itself re-checks ownership (p_user_id) and uniqueness, and does
  // the migration atomically — so a partial rename can never orphan data.
  const admin = getAdminSupabase();
  const { data, error } = await admin.rpc("rename_card_slug", {
    p_card_id: id,
    p_user_id: user.id,
    p_new_slug: slug,
  });

  if (error) {
    // Most likely the migration (supabase/rename-card-slug.sql) hasn't been run
    // yet — surface a clear message rather than a raw Postgres error.
    console.error("rename_card_slug failed:", error.message, { cardId: id });
    return NextResponse.json({ error: "Couldn't change the URL right now. Please try again." }, { status: 500 });
  }

  const result = (data ?? {}) as { ok?: boolean; error?: string; unchanged?: boolean; old?: string; new?: string };
  if (!result.ok) {
    if (result.error === "taken") {
      return NextResponse.json({ error: "That URL is already taken — try another." }, { status: 409 });
    }
    if (result.error === "not_found") {
      return NextResponse.json({ error: "That card isn't yours to rename." }, { status: 404 });
    }
    return NextResponse.json({ error: "That URL isn't valid — use letters, numbers, and dashes." }, { status: 400 });
  }

  // The RPC migrates every slug-keyed TABLE, but the stored card images live in
  // public storage buckets keyed by slug — they don't move. Drop the ones at the
  // OLD slug: they're stale for this card (the live-rendered fallback takes over
  // and self-heals on the next capture), and leaving them means whoever takes the
  // freed slug next inherits this card's image on their public link previews and
  // email signature. Best-effort — never fail a completed rename over an image.
  if (!result.unchanged && result.old) {
    const oldSlug = result.old;
    await Promise.all([
      admin.storage.from("card-shares").remove([`${oldSlug}.png`]).then(() => {}, () => {}),
      admin.storage.from("card-signatures").remove([`${oldSlug}.png`]).then(() => {}, () => {}),
    ]);
  }

  return NextResponse.json({ ok: true, slug, unchanged: !!result.unchanged });
}
