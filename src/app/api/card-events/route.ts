import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { getSourceLabel } from "@/lib/source-labels";
import { dispatchCrmEvent } from "@/lib/crm-events";

// Public: called from card page without auth
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      card_owner_username,
      visitor_id,
      event_type,
      source,
      visitor_name,
      visitor_email,
      visitor_phone,
      referrer_url,
      device_info,
    } = body;

    if (!card_owner_username || !event_type) {
      return NextResponse.json({ ok: true });
    }

    const admin = getAdminSupabase();

    await admin.from("card_events").insert({
      card_owner_username,
      visitor_id: visitor_id || null,
      event_type,
      source: source || "direct_link",
      visitor_name: visitor_name || null,
      visitor_email: visitor_email || null,
      visitor_phone: visitor_phone || null,
      referrer_url: referrer_url || null,
      device_info: device_info || null,
    });

    // Fire in-app notification for meaningful events (not every view)
    if (event_type === "downloaded_vcard") {
      // card_owner_username is the CARD's slug — resolve through the cards
      // table first (multi-card accounts), then the legacy profile slug.
      const { data: cardRow } = await admin.from("cards").select("user_id").eq("username", card_owner_username).maybeSingle();
      const { data: owner } = cardRow?.user_id
        ? await admin.from("profiles").select("id").eq("id", cardRow.user_id).maybeSingle()
        : await admin.from("profiles").select("id").eq("username", card_owner_username).maybeSingle();

      if (owner?.id) {
        const sourceLabel = getSourceLabel(source);
        const who = visitor_name ? `${visitor_name} saved` : "Someone saved";
        const body = `${who} your contact card${source && source !== "direct_link" ? ` from ${sourceLabel}` : ""}.`;
        const { insertNotification } = await import("@/lib/notify");
        await insertNotification({
          user_id: owner.id,
          card_owner: card_owner_username,
          type: "contact_saved",
          title: "Contact saved",
          body,
        });
        // Mirror this conversation notification to the owner's CRM.
        await dispatchCrmEvent(card_owner_username, {
          type: "conversation.notification",
          event: "contact_saved",
          title: "Contact saved",
          body,
          contact: { name: visitor_name || null, email: visitor_email || null, phone: visitor_phone || null },
          source: source || "direct_link",
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

// Private: fetch events for a visitor (card owner only)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json([], { status: 200 });

    const visitorId = req.nextUrl.searchParams.get("visitor_id");
    if (!visitorId) return NextResponse.json([], { status: 200 });

    const admin = getAdminSupabase();
    const { data } = await admin
      .from("card_events")
      .select("id, event_type, source, visitor_name, visitor_email, created_at")
      .eq("card_owner_username", profile.username)
      .eq("visitor_id", visitorId)
      .order("created_at", { ascending: true });

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
