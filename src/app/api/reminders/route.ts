import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";

const SEQUENCE = [
  {
    day: 1,
    subject: (name: string) => `Follow up with ${name} today 🔥`,
    intro: "just shared their info with you. The best time to reach out is now.",
  },
  {
    day: 15,
    subject: (name: string) => `15-day check-in: ${name}`,
    intro: "connected with you 15 days ago. A quick message keeps the relationship warm.",
  },
  {
    day: 30,
    subject: (name: string) => `Don't lose ${name}`,
    intro: "shared their info 30 days ago. One message now could turn this into real business.",
  },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = getSupabase();
  let totalSent = 0;

  for (const step of SEQUENCE) {
    const now = Date.now();
    const windowStart = new Date(now - (step.day + 1) * 86400000).toISOString();
    const windowEnd = new Date(now - step.day * 86400000).toISOString();

    const { data: candidates } = await supabase
      .from("leads")
      .select("id, name, email, phone, notes, card_owner")
      .gte("created_at", windowStart)
      .lt("created_at", windowEnd);

    if (!candidates?.length) continue;

    const ids = candidates.map((l) => l.id);
    const { data: alreadySent } = await supabase
      .from("lead_reminders")
      .select("lead_id")
      .in("lead_id", ids)
      .eq("day_trigger", step.day);

    const sentSet = new Set(alreadySent?.map((r) => r.lead_id) ?? []);
    const pending = candidates.filter((l) => !sentSet.has(l.id));
    if (!pending.length) continue;

    // Group by card_owner
    const byOwner: Record<string, typeof pending> = {};
    for (const lead of pending) {
      byOwner[lead.card_owner] = byOwner[lead.card_owner] ?? [];
      byOwner[lead.card_owner].push(lead);
    }

    for (const [username, leads] of Object.entries(byOwner)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email, phone, company")
        .eq("username", username)
        .single();

      if (!profile?.email) continue;

      const ownerFirst = profile.name?.split(" ")[0] ?? "there";
      const isPlural = leads.length > 1;

      // Email to card owner
      const leadRows = leads
        .map(
          (l) => `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #1f2937;">
              <p style="margin:0;font-weight:600;color:#ffffff;">${l.name}</p>
              <a href="mailto:${l.email}" style="color:#60a5fa;font-size:13px;">${l.email}</a>
              ${l.phone ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">${l.phone}</p>` : ""}
              ${l.notes ? `<p style="margin:4px 0 0;color:#9ca3af;font-size:12px;font-style:italic;">${l.notes}</p>` : ""}
            </td>
          </tr>`
        )
        .join("");

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Kontact <onboarding@resend.dev>",
        to: profile.email,
        subject: step.subject(isPlural ? `${leads.length} leads` : leads[0].name),
        html: `
          <div style="background:#030712;min-height:100vh;padding:48px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:520px;margin:0 auto;">
              <p style="font-size:11px;font-weight:700;letter-spacing:0.2em;color:#4b5563;text-transform:uppercase;margin:0 0 32px;">KONTACT</p>
              <h1 style="font-size:24px;font-weight:700;color:#ffffff;margin:0 0 8px;">
                Hey ${ownerFirst} 👋
              </h1>
              <p style="color:#9ca3af;font-size:15px;margin:0 0 32px;">
                ${isPlural ? `${leads.length} people` : leads[0].name} ${step.intro}
              </p>
              <table style="width:100%;border-collapse:collapse;">
                ${leadRows}
              </table>
              <div style="margin-top:32px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app"}/dashboard"
                   style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:99px;font-size:14px;font-weight:600;">
                  Open Dashboard →
                </a>
              </div>
              <p style="color:#374151;font-size:12px;margin-top:40px;border-top:1px solid #111827;padding-top:20px;">
                Kontact sends follow-up reminders at day 1, 15, and 30 after a lead connects with you.
              </p>
            </div>
          </div>
        `,
      });

      // Day-1 only: also send a warm follow-up directly to each lead
      if (step.day === 1) {
        for (const lead of leads) {
          if (!lead.email) continue;
          const leadFirst = lead.name.split(" ")[0];

          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "Kontact <onboarding@resend.dev>",
            replyTo: profile.email,
            to: lead.email,
            subject: `Hey ${leadFirst}, it was great meeting you! — ${ownerFirst}`,
            html: `
              <div style="background:#ffffff;padding:48px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                <div style="max-width:480px;margin:0 auto;">
                  <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 16px;">
                    Hey ${leadFirst}! 😊
                  </h2>
                  <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
                    It was so nice meeting you yesterday! I just wanted to follow up and make sure we stay in touch.
                  </p>
                  <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
                    Feel free to reach out to me anytime — I'd love to keep the conversation going.
                  </p>

                  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
                    <p style="margin:0 0 6px;font-weight:700;color:#111827;font-size:15px;">${profile.name}</p>
                    ${profile.company ? `<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">${profile.company}</p>` : ""}
                    <a href="mailto:${profile.email}" style="display:block;color:#2563eb;font-size:13px;margin:0 0 4px;">${profile.email}</a>
                    ${profile.phone ? `<a href="tel:${profile.phone}" style="display:block;color:#2563eb;font-size:13px;">${profile.phone}</a>` : ""}
                  </div>

                  <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
                    Talk soon,<br/>
                    <strong style="color:#111827;">${ownerFirst}</strong>
                  </p>

                  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f3f4f6;">
                    <p style="color:#9ca3af;font-size:11px;margin:0;">Sent via <a href="https://relationship-app-alpha.vercel.app" style="color:#9ca3af;">Kontact</a></p>
                  </div>
                </div>
              </div>
            `,
          }).catch(() => {});
        }
      }

      await supabase.from("lead_reminders").insert(
        leads.map((l) => ({ lead_id: l.id, day_trigger: step.day }))
      );

      totalSent++;
    }
  }

  return NextResponse.json({ sent: totalSent });
}
