import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan } from "@/lib/plan";
import { deliverToLead } from "@/lib/messaging";
import Anthropic from "@anthropic-ai/sdk";

type FlowDay = { enabled: boolean; time: string };
type FlowSettings = { day1: FlowDay; day15: FlowDay; day30: FlowDay; customNote?: string };

const DEFAULT_FLOW: FlowSettings = {
  day1:  { enabled: true, time: "13:00" },
  day15: { enabled: true, time: "13:00" },
  day30: { enabled: true, time: "13:00" },
};

const SEQUENCE: {
  day: 1 | 15 | 30;
  key: "day1" | "day15" | "day30";
  subject: (n: string) => string;
  intro: string;
  leadSubject: (ownerFirst: string) => string;
  leadPrompt: (ownerName: string, ownerTitle: string, ownerCompany: string, leadFirst: string, leadMessage: string) => string;
  leadFallback: (ownerFirst: string) => string;
}[] = [
  {
    day: 1,
    key: "day1",
    subject: (name) => `Follow up with ${name} today`,
    intro: "just shared their info with you. The best time to reach out is now.",
    leadSubject: (ownerFirst) => `${ownerFirst} following up`,
    leadPrompt: (ownerName, ownerTitle, ownerCompany, leadFirst, leadMessage) =>
      `Write a short, warm 2-3 sentence follow-up email body from ${ownerName}${ownerTitle ? ` (${ownerTitle})` : ""}${ownerCompany ? ` at ${ownerCompany}` : ""} to ${leadFirst}, who saved their contact info with them yesterday.${leadMessage ? `\n${leadFirst} mentioned: "${leadMessage}"` : ""}

Rules:
- Sound like a real person, not a template
- Warm but not over the top
- End with one natural next step (offer to chat, answer questions, etc.)
- Do NOT start with "Hey" or "Hi ${leadFirst}"
- Do NOT mention "digital business card" or "networking"
- Return only the body text (2-3 sentences, no subject, no sign-off)`,
    leadFallback: () => "It was great connecting with you! Just wanted to make sure you have my contact info — feel free to reach out anytime.",
  },
  {
    day: 15,
    key: "day15",
    subject: (name) => `15-day check-in: ${name}`,
    intro: "connected with you 15 days ago. A quick message keeps the relationship warm.",
    leadSubject: (ownerFirst) => `Checking in — ${ownerFirst}`,
    leadPrompt: (ownerName, ownerTitle, ownerCompany, leadFirst, leadMessage) =>
      `Write a brief, natural 2-3 sentence check-in email from ${ownerName}${ownerTitle ? ` (${ownerTitle})` : ""}${ownerCompany ? ` at ${ownerCompany}` : ""} to ${leadFirst}, who connected with them about 2 weeks ago.${leadMessage ? `\n${leadFirst} originally mentioned: "${leadMessage}"` : ""}

Rules:
- Sound genuinely interested, not salesy
- Reference the time that has passed naturally
- End with a soft, low-pressure next step
- Do NOT start with "Hey" or "Hi ${leadFirst}"
- Do NOT mention "digital business card" or "networking"
- Return only the body text (2-3 sentences, no subject, no sign-off)`,
    leadFallback: (ownerFirst) => `Just checking in — it's been a couple of weeks since we connected and I wanted to see how things are going. Don't hesitate to reach out if there's anything I can help with. — ${ownerFirst}`,
  },
  {
    day: 30,
    key: "day30",
    subject: (name) => `Don't lose ${name}`,
    intro: "shared their info 30 days ago. One message now could turn this into real business.",
    leadSubject: (ownerFirst) => `One more thing — ${ownerFirst}`,
    leadPrompt: (ownerName, ownerTitle, ownerCompany, leadFirst, leadMessage) =>
      `Write a concise, genuine 2-3 sentence final touchpoint email from ${ownerName}${ownerTitle ? ` (${ownerTitle})` : ""}${ownerCompany ? ` at ${ownerCompany}` : ""} to ${leadFirst}, who they met about a month ago.${leadMessage ? `\n${leadFirst} originally mentioned: "${leadMessage}"` : ""}

Rules:
- Acknowledge it's been a while without making it awkward
- Keep it brief and human
- Make the call to action easy to say yes to
- Do NOT start with "Hey" or "Hi ${leadFirst}"
- Do NOT mention "digital business card" or "networking"
- Return only the body text (2-3 sentences, no subject, no sign-off)`,
    leadFallback: (ownerFirst) => `It's been about a month since we connected — I just wanted to circle back in case the timing is better now. Would love to reconnect when you're ready. — ${ownerFirst}`,
  },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = getAdminSupabase();
  const currentUTCHour = new Date().getUTCHours();
  let totalSent = 0;

  for (const step of SEQUENCE) {
    const now = Date.now();
    const windowStart = new Date(now - (step.day + 1) * 86400000).toISOString();
    const windowEnd   = new Date(now - step.day       * 86400000).toISOString();

    const { data: candidates } = await supabase
      .from("leads")
      .select("id, name, email, phone, message, notes, card_owner, tags, follow_up_sequence")
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
    // Skip the default Day-1/15/30 flow for leads that have a custom follow-up
    // sequence — that sequence takes over, so we never double-send.
    const pending = candidates.filter((l) => {
      if (sentSet.has(l.id) || (l.tags ?? []).includes("flow-paused")) return false;
      const seq = (l as { follow_up_sequence?: unknown[] }).follow_up_sequence;
      if (Array.isArray(seq) && seq.length > 0) return false;
      return true;
    });
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
        .select("name, email, phone, company, title, flow_settings, plan, customization")
        .eq("username", username)
        .single();

      if (!profile?.email) continue;
      const ownerAbout = ((profile.customization as { about?: string } | null)?.about ?? "").trim();

      // Free gets only the Day-1 reminder; multi-day automation is Pro/Office.
      if (step.key !== "day1" && !isPaidPlan(profile.plan)) continue;

      // Respect the user's flow settings
      const flow: FlowSettings = (profile.flow_settings as FlowSettings) ?? DEFAULT_FLOW;
      const dayConfig: FlowDay = flow[step.key] ?? DEFAULT_FLOW[step.key];

      // Skip if this reminder day is disabled
      if (!dayConfig.enabled) continue;

      // Skip if this isn't the right UTC hour
      const [configHour] = dayConfig.time.split(":").map(Number);
      if (configHour !== currentUTCHour) continue;

      const ownerFirst = profile.name?.split(" ")[0] ?? "there";
      const isPlural = leads.length > 1;
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

      const leadRows = leads.map((l) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #1f2937;">
            <p style="margin:0;font-weight:600;color:#ffffff;">${l.name}</p>
            <a href="mailto:${l.email}" style="color:#60a5fa;font-size:13px;">${l.email}</a>
            ${l.phone ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">${l.phone}</p>` : ""}
            ${l.notes ? `<p style="margin:4px 0 0;color:#9ca3af;font-size:12px;font-style:italic;">${l.notes}</p>` : ""}
          </td>
        </tr>`).join("");

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>",
        to: profile.email,
        subject: step.subject(isPlural ? `${leads.length} leads` : leads[0].name),
        html: `
          <div style="background:#030712;min-height:100vh;padding:48px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:520px;margin:0 auto;">
              <p style="font-size:11px;font-weight:700;letter-spacing:0.2em;color:#4b5563;text-transform:uppercase;margin:0 0 32px;">SWIFTCARD</p>
              <h1 style="font-size:24px;font-weight:700;color:#ffffff;margin:0 0 8px;">Hey ${ownerFirst}</h1>
              <p style="color:#9ca3af;font-size:15px;margin:0 0 32px;">
                ${isPlural ? `${leads.length} people` : leads[0].name} ${step.intro}
              </p>
              <table style="width:100%;border-collapse:collapse;">${leadRows}</table>
              <div style="margin-top:32px;">
                <a href="${APP_URL}/dashboard"
                   style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:99px;font-size:14px;font-weight:600;">
                  Open Dashboard →
                </a>
              </div>
              <p style="color:#374151;font-size:12px;margin-top:40px;border-top:1px solid #111827;padding-top:20px;">
                You're receiving this because you enabled day-${step.day} reminders in SwiftCard.
                <a href="${APP_URL}/settings/flows" style="color:#4b5563;">Manage settings</a>
              </p>
            </div>
          </div>`,
      });

      // Send personalized AI follow-up to each lead that has an email
      {
        const anthropic = process.env.ANTHROPIC_API_KEY
          ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
          : null;

        for (const lead of leads) {
          const leadFirst = lead.name.split(" ")[0];

          let aiBody = "";
          if (anthropic) {
            try {
              const resp = await anthropic.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 200,
                messages: [{
                  role: "user",
                  content: `${step.leadPrompt(
                    profile.name ?? ownerFirst,
                    profile.title ?? "",
                    profile.company ?? "",
                    leadFirst,
                    lead.message ?? ""
                  )}${ownerAbout ? `\n\nWhat I do/offer (reference naturally, speak to the right things): ${ownerAbout}` : ""}`,
                }],
              });
              aiBody = resp.content[0].type === "text" ? resp.content[0].text.trim() : "";
            } catch {
              aiBody = "";
            }
          }

          const emailBody = aiBody || step.leadFallback(ownerFirst);
          const customNote = flow.customNote?.trim();
          const fullBody = customNote ? `${emailBody}\n\n${customNote}` : emailBody;

          // Deliver via email (free) or SMS fallback (one shared number),
          // respecting opt-out and logging into the contact's conversation thread.
          await deliverToLead({
            leadId: lead.id,
            cardOwner: username,
            lead: { email: lead.email, phone: lead.phone, name: lead.name },
            sender: { name: profile.name, company: profile.company, phone: profile.phone, email: profile.email, website: null },
            text: fullBody,
            cardUsername: username,
            email: {
              subject: step.leadSubject(ownerFirst),
              html: `
              <div style="background:#ffffff;padding:48px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                <div style="max-width:480px;margin:0 auto;">
                  <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">Hey ${leadFirst},<br/><br/>${fullBody.replace(/\n/g, "<br/>")}</p>
                  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
                    <p style="margin:0 0 6px;font-weight:700;color:#111827;font-size:15px;">${profile.name}</p>
                    ${profile.title ? `<p style="margin:0 0 4px;color:#6b7280;font-size:12px;">${profile.title}</p>` : ""}
                    ${profile.company ? `<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">${profile.company}</p>` : ""}
                    <a href="mailto:${profile.email}" style="display:block;color:#2563eb;font-size:13px;margin:0 0 4px;">${profile.email}</a>
                    ${profile.phone ? `<a href="tel:${profile.phone}" style="display:block;color:#2563eb;font-size:13px;">${profile.phone}</a>` : ""}
                  </div>
                  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f3f4f6;">
                    <p style="color:#d1d5db;font-size:11px;margin:0;">Sent via SwiftCard</p>
                  </div>
                </div>
              </div>`,
            },
          });
        }
      }

      await supabase.from("lead_reminders").insert(
        leads.map((l) => ({ lead_id: l.id, day_trigger: step.day }))
      );

      totalSent++;
    }
  }

  // === PRESET-BASED SEQUENCE PROCESSING ===
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const { data: seqLeads } = await supabase
    .from("leads")
    .select("id, name, email, phone, card_owner, created_at, follow_up_sequence, tags, status")
    .neq("status", "dissolved")
    .not("follow_up_sequence", "is", null);

  for (const seqLead of seqLeads ?? []) {
    const seq = seqLead.follow_up_sequence as { day: number; time?: string; message: string; subject?: string; channel?: string; sent_at: string | null }[] | null;
    if (!seq?.length) continue;
    if ((seqLead.tags ?? []).includes("flow-paused")) continue;

    const createdAt = new Date(seqLead.created_at).getTime();

    for (const item of seq) {
      if (item.sent_at) continue;
      const dueMs = createdAt + item.day * 86400000;
      if (dueMs < todayStart.getTime() || dueMs >= todayEnd.getTime()) continue;
      // Honor the step's scheduled time-of-day (cron runs hourly; send at/after the hour).
      if (item.time) {
        const stepHour = parseInt(item.time.split(":")[0], 10);
        if (!Number.isNaN(stepHour) && currentUTCHour < stepHour) continue;
      }

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("name, email, phone, title, company")
        .eq("username", seqLead.card_owner)
        .single();

      if (!ownerProfile) continue;

      const ownerFirst = (ownerProfile.name as string)?.split(" ")[0] ?? "there";
      const leadFirst = (seqLead.name as string).split(" ")[0];

      const r = await deliverToLead({
        leadId: seqLead.id,
        cardOwner: seqLead.card_owner,
        lead: { email: seqLead.email, phone: seqLead.phone, name: seqLead.name },
        sender: { name: ownerProfile.name, company: ownerProfile.company, phone: ownerProfile.phone, email: ownerProfile.email, website: null },
        text: item.message,
        cardUsername: seqLead.card_owner,
        channel: item.channel === "sms" ? "sms" : item.channel === "email" ? "email" : undefined,
        email: {
          subject: item.subject?.trim() || `${ownerFirst} following up`,
          html: `<div style="background:#ffffff;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><div style="max-width:520px;margin:0 auto;color:#1f2937;font-size:15px;line-height:1.6;"><p style="margin:0 0 22px;">Hi ${leadFirst},<br/><br/>${(item.message as string).replace(/\n/g, "<br/>")}</p><div style="margin-top:22px;padding-top:14px;border-top:1px solid #e5e7eb;"><p style="margin:0 0 2px;font-weight:700;color:#111827;font-size:14px;">${ownerProfile.name}</p>${ownerProfile.title || ownerProfile.company ? `<p style="margin:0 0 6px;color:#6b7280;font-size:13px;">${[ownerProfile.title, ownerProfile.company].filter(Boolean).join(" · ")}</p>` : ""}${ownerProfile.email ? `<a href="mailto:${ownerProfile.email}" style="display:block;color:#2563eb;font-size:13px;text-decoration:none;">${ownerProfile.email}</a>` : ""}<a href="${process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me"}/card/${seqLead.card_owner}" style="display:inline-block;margin-top:8px;color:#2563eb;font-size:13px;font-weight:600;text-decoration:none;">View my card →</a></div><p style="color:#9ca3af;font-size:11px;margin-top:16px;">Sent via SwiftCard</p></div></div>`,
        },
      });

      // Mark this step done unless it failed transiently (those retry next run).
      if (r.status === "sent" || r.status === "opted_out" || r.status === "no_contact") {
        const updatedSeq = seq.map((s) =>
          s.day === item.day ? { ...s, sent_at: new Date().toISOString() } : s
        );
        await supabase.from("leads").update({ follow_up_sequence: updatedSeq }).eq("id", seqLead.id);
        if (r.status === "sent") totalSent++;
      }
    }
  }
  // === END PRESET-BASED SEQUENCE PROCESSING ===

  return NextResponse.json({ sent: totalSent, checkedHour: currentUTCHour });
}
