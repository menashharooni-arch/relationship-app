import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

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

  // vCard escaping (RFC 6350): these fields are VISITOR-supplied — a name with
  // an embedded newline or ";" could otherwise inject arbitrary vCard fields
  // into the contact saved on the owner's phone.
  const esc = (v: string | null | undefined) =>
    String(v ?? "").replace(/[\r\n]+/g, " ").replace(/([,;\\])/g, "\\$1").trim();

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(lead.name)}`,
    lead.phone ? `TEL;TYPE=CELL:${esc(lead.phone)}` : null,
    lead.email ? `EMAIL:${esc(lead.email)}` : null,
    lead.company ? `ORG:${esc(lead.company)}` : null,
    "END:VCARD",
  ].filter(Boolean).join("\r\n");

  const slug = lead.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.vcf"`,
    },
  });
}
