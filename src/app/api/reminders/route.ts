import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  // Verify this is called by Vercel Cron
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const today = new Date().toISOString().split("T")[0];

  // Get all leads with follow_up_date = today, joined with the card owner's profile
  const { data: leads } = await supabase
    .from("leads")
    .select("name, email, phone, notes, card_owner")
    .eq("follow_up_date", today);

  if (!leads || leads.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Group leads by card_owner
  const byOwner = leads.reduce<Record<string, typeof leads>>((acc, lead) => {
    acc[lead.card_owner] = acc[lead.card_owner] ?? [];
    acc[lead.card_owner].push(lead);
    return acc;
  }, {});

  let sent = 0;

  for (const [username, ownerLeads] of Object.entries(byOwner)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("username", username)
      .single();

    if (!profile?.email) continue;

    const leadList = ownerLeads
      .map(
        (l) =>
          `<li style="margin-bottom:12px;">
            <strong>${l.name}</strong> — <a href="mailto:${l.email}">${l.email}</a>
            ${l.phone ? `<br/>${l.phone}` : ""}
            ${l.notes ? `<br/><em style="color:#6b7280;">${l.notes}</em>` : ""}
          </li>`
      )
      .join("");

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Evercard <onboarding@resend.dev>",
      to: profile.email,
      subject: `${ownerLeads.length} follow-up${ownerLeads.length > 1 ? "s" : ""} due today`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px 16px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#9ca3af;text-transform:uppercase;margin-bottom:24px;">EVERCARD</p>
          <h1 style="font-size:22px;font-weight:700;color:#111827;margin-bottom:8px;">
            Hey ${profile.name.split(" ")[0]}, time to follow up
          </h1>
          <p style="color:#6b7280;font-size:15px;margin-bottom:24px;">
            You set a reminder to reach out to ${ownerLeads.length === 1 ? "this person" : "these people"} today:
          </p>
          <ul style="list-style:none;padding:0;margin:0 0 32px;">
            ${leadList}
          </ul>
          <a href="https://relationship-app-alpha.vercel.app/dashboard"
             style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:99px;font-size:14px;font-weight:600;">
            Open Dashboard →
          </a>
          <p style="color:#d1d5db;font-size:12px;margin-top:32px;">
            Evercard · You're receiving this because you set a follow-up reminder.
          </p>
        </div>
      `,
    });

    sent++;
  }

  return NextResponse.json({ sent });
}
