import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { ownsLead } from "@/lib/lead-access";
import { isRateLimited } from "@/lib/rate-limit";
import { contactCardUrl } from "@/lib/contact-links";

// "Copy personal link" on a contact: the owner's card URL carrying this
// contact's own token (lib/contact-links.ts), for pasting into a message the
// owner sends themselves — WhatsApp, LinkedIn, their own email. Opening it is
// how that contact's browser gets recognised as them.
//
// A fresh token per copy, so each one can be revoked and counted on its own.
// Falls back to the plain card URL when the link can't be minted (the
// migration isn't applied): the button still copies something that works.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await isRateLimited(`contact-link:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const admin = getAdminSupabase();
  const [{ data: lead }, usernames] = await Promise.all([
    admin.from("leads").select("id, card_owner").eq("id", id).maybeSingle(),
    getOwnerUsernames(user.id),
  ]);
  if (!lead || !ownsLead(usernames, lead)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await contactCardUrl(admin, {
    leadId: lead.id as string,
    cardSlug: lead.card_owner as string,
    channel: "manual_copy",
  });
  return NextResponse.json({ url });
}
