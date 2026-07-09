import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { sendSms, isOptedOut } from "@/lib/messaging";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Text YOUR card to a saved contact through the app's Twilio number — for
// when you have their number but they don't have yours. POST { leadId }.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId } = (await req.json().catch(() => ({}))) as { leadId?: string };
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: lead } = await admin
    .from("leads")
    .select("id, name, phone, card_owner")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // The contact must belong to one of THIS user's cards.
  const owned = await getOwnerUsernames(user.id);
  if (!owned.includes(lead.card_owner as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!lead.phone) return NextResponse.json({ error: "This contact has no phone number." }, { status: 400 });

  // STOP compliance — a number that opted out never gets texted again, even manually.
  if (await isOptedOut("sms", lead.phone as string)) {
    return NextResponse.json({ error: "This contact opted out of texts (replied STOP)." }, { status: 409 });
  }

  const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).maybeSingle();
  const ownerName = (profile?.name as string) || "A SwiftCard user";
  const contactFirst = ((lead.name as string) || "").split(" ")[0];

  const cardUrl = `${APP_URL}/card/${lead.card_owner}`;
  const body =
    `${contactFirst ? `Hi ${contactFirst}! ` : ""}${ownerName} here — great connecting. ` +
    `Save my contact info: ${cardUrl}\n` +
    `via SwiftCard · Reply STOP to opt out`;

  const result = await sendSms(lead.phone as string, body);
  if (result === "not_configured") {
    return NextResponse.json({ error: "Texting isn't set up yet (Twilio number required)." }, { status: 503 });
  }
  if (result !== "sent") {
    return NextResponse.json({ error: "Couldn't send the text. Check the phone number and try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
