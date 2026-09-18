import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { ownsLead } from "@/lib/lead-access";
import { ALERTS_MUTED_TAG } from "@/lib/contact-return-notify";

// The per-contact mute (warm-lead plan §2.4). A muted contact's visits still
// reach the bell and their history; they just never reach the lock screen.
//
// Its own route rather than a PATCH of `tags`: the tag is reserved
// (lib/lead-tags.ts), so an ordinary tag edit can neither set it by accident
// nor drop it, and it never leaves for a CRM.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (typeof body?.muted !== "boolean") return NextResponse.json({ error: "muted must be true or false" }, { status: 400 });

  const admin = getAdminSupabase();
  const [{ data: lead }, usernames] = await Promise.all([
    admin.from("leads").select("id, card_owner, tags").eq("id", id).maybeSingle(),
    getOwnerUsernames(user.id),
  ]);
  if (!lead || !ownsLead(usernames, lead)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tags = ((lead.tags as string[] | null) ?? []).filter((t) => t !== ALERTS_MUTED_TAG);
  if (body.muted) tags.push(ALERTS_MUTED_TAG);
  const { error } = await admin.from("leads").update({ tags }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  return NextResponse.json({ muted: body.muted });
}
