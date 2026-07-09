import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // No ?card= → ALL cards (the bell). ?card=X → that card only, plus legacy
  // un-tagged/account-level notifications (the dashboard panel).
  const card = (req.nextUrl.searchParams.get("card") || "").replace(/[^a-zA-Z0-9_-]/g, "");

  let q = supabase
    .from("notifications")
    .select("id, type, title, body, read, created_at, card_owner")
    .eq("user_id", user.id);
  if (card) q = q.or(`card_owner.eq.${card},card_owner.is.null`);

  const { data: scoped, error } = await q.order("created_at", { ascending: false }).limit(20);
  let data: Record<string, unknown>[] | null = scoped;

  // If the card_owner column migration hasn't run yet, selecting/filtering on
  // it errors and the bell would show nothing — fall back to the plain query.
  if (error) {
    ({ data } = await supabase
      .from("notifications")
      .select("id, type, title, body, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20));
  }

  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; read?: boolean; card?: string } = {};
  try { body = await req.json(); } catch { /* no body = mark all read */ }

  if (body.id) {
    // Toggle a single notification's read state.
    await supabase
      .from("notifications")
      .update({ read: body.read ?? true })
      .eq("user_id", user.id)
      .eq("id", body.id);
  } else {
    // Mark all read. With { card } (the per-card dashboard panel) only that
    // card's notifications + account-level ones are touched — never another
    // card's. Without it (the bell) it's genuinely all cards.
    const card = (body.card || "").replace(/[^a-zA-Z0-9_-]/g, "");
    let q = supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    if (card) q = q.or(`card_owner.eq.${card},card_owner.is.null`);
    const { error } = await q;
    // card_owner column missing → scoped update errors; retry unscoped so the
    // button still works (matches pre-migration behavior).
    if (error && card) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
    }
  }

  return NextResponse.json({ success: true });
}

// Dismiss notifications: { id } removes one, { read: true } clears all read
// ones — card-scoped when { card } is given (the per-card panel).
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; read?: boolean; card?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  if (body.id) {
    await supabase.from("notifications").delete().eq("user_id", user.id).eq("id", body.id);
  } else if (body.read) {
    const card = (body.card || "").replace(/[^a-zA-Z0-9_-]/g, "");
    let q = supabase.from("notifications").delete().eq("user_id", user.id).eq("read", true);
    if (card) q = q.or(`card_owner.eq.${card},card_owner.is.null`);
    const { error } = await q;
    if (error && card) {
      // Column missing → fall back to the old unscoped clear (read-only rows,
      // and the user explicitly asked to clear them).
      await supabase.from("notifications").delete().eq("user_id", user.id).eq("read", true);
    }
  }

  return NextResponse.json({ success: true });
}
