import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { buildVCard } from "@/lib/vcard";

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("id");
  if (!leadId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = getAdminSupabase();

  let lead: { name: string; phone: string | null; email: string | null; company: string | null } | null = null;

  if (user) {
    const { data: profile } = await admin.from("profiles").select("username").eq("id", user.id).single();
    const { data: extraCards } = await admin.from("cards").select("username").eq("user_id", user.id);
    const usernames = [profile?.username, ...(extraCards ?? []).map((c: { username: string }) => c.username)].filter(Boolean);

    const { data } = await admin.from("leads").select("name, phone, email, company").eq("id", leadId).in("card_owner", usernames).single();
    lead = data;
  }

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Shared builder handles RFC 6350 escaping — these fields are VISITOR-supplied,
  // so a name with an embedded newline or ";" could otherwise inject arbitrary
  // vCard fields into the contact saved on the owner's phone. A captured lead has
  // no headshot, so PHOTO is simply omitted.
  const vcard = buildVCard({
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phones: lead.phone ? [{ number: lead.phone, label: "mobile" }] : undefined,
  });

  const slug = lead.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  return new NextResponse(vcard, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.vcf"`,
    },
  });
}
