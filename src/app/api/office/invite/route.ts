import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify user owns an office
  const { data: office } = await supabase
    .from("offices")
    .select("id, name, seats")
    .eq("owner_id", user.id)
    .single();

  if (!office) return NextResponse.json({ error: "No office found. Create one first." }, { status: 404 });

  // Check seat limit
  const { count } = await supabase
    .from("office_members")
    .select("*", { count: "exact", head: true })
    .eq("office_id", office.id)
    .eq("status", "active");

  if ((count ?? 0) >= office.seats) {
    return NextResponse.json({ error: `Seat limit reached (${office.seats} seats). Upgrade to add more.` }, { status: 400 });
  }

  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // Check for duplicate
  const { data: existing } = await supabase
    .from("office_members")
    .select("id, status")
    .eq("office_id", office.id)
    .eq("invite_email", email.trim().toLowerCase())
    .single();

  if (existing?.status === "active") {
    return NextResponse.json({ error: "This person is already a member." }, { status: 400 });
  }

  // Upsert: re-send invite if pending
  let token: string;
  if (existing) {
    // Resend existing invite
    const { data: member } = await supabase
      .from("office_members")
      .select("invite_token")
      .eq("id", existing.id)
      .single();
    token = member!.invite_token;
  } else {
    const { data: member, error } = await supabase
      .from("office_members")
      .insert({ office_id: office.id, invite_email: email.trim().toLowerCase() })
      .select("invite_token")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    token = member!.invite_token;
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();

  const inviteUrl = `${APP_URL}/join/${token}`;
  const ownerFirst = (ownerProfile?.name ?? "Your team").split(" ")[0];

  await resend.emails.send({
    from: "Kontact <onboarding@resend.dev>",
    to: email.trim(),
    subject: `${ownerFirst} invited you to join ${office.name} on Kontact`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
        <h2 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px;">You're invited to ${office.name}</h2>
        <p style="color:#555;margin:0 0 24px;">${ownerFirst} has invited you to join their team on Kontact — the digital business card platform. You'll get your own card and access to the team dashboard.</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:100px;font-size:15px;">Accept invitation →</a>
        <p style="color:#999;font-size:12px;margin-top:28px;">This invite expires in 7 days. If you didn't expect this, ignore this email.</p>
        <p style="color:#ccc;font-size:11px;margin:0;">Powered by Kontact</p>
      </div>
    `,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
