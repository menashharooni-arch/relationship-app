import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan } from "@/lib/plan";
import { deliverToLead } from "@/lib/messaging";
import { expireFreeMonths } from "@/lib/referral-server";
import { insertNotification } from "@/lib/notify";
import { trialEndingSoonEmail, trialEndedEmail } from "@/lib/email-templates";
import { aiComplete } from "@/lib/ai";

type FlowDay = { enabled: boolean; time: string };
type FlowSettings = { day1: FlowDay; day15: FlowDay; day30: FlowDay; customNote?: string };

// Automations send AS the card the contact came through: each card has its own
// name/title/company/email, so the sender identity (and the reply-to address)
// is the CARD's, with the owning profile supplying plan/settings/fallbacks.
// Legacy contacts on profile slugs resolve through the profile as before.
async function resolveCardSender(supabase: ReturnType<typeof getAdminSupabase>, username: string) {
  const { data: card } = await supabase
    .from("cards")
    .select("user_id, name, title, company, email, phone")
    .eq("username", username)
    .maybeSingle();
  const profileSelect = "id, name, email, phone, company, title, flow_settings, plan, customization";
  const { data: profile } = card?.user_id
    ? await supabase.from("profiles").select(profileSelect).eq("id", card.user_id).maybeSingle()
    : await supabase.from("profiles").select(profileSelect).eq("username", username).maybeSingle();
  if (!profile) return null;
  const sender = {
    name: (card?.name as string) || (profile.name as string) || null,
    title: (card?.title as string) || (profile.title as string) || null,
    company: (card?.company as string) || (profile.company as string) || null,
    email: (card?.email as string) || (profile.email as string) || null, // replies go to the card's email
    phone: (card?.phone as string) || (profile.phone as string) || null,
  };
  const ownerId = (card?.user_id as string) ?? (profile.id as string) ?? null;
  return { profile, sender, ownerId };
}

// Per-contact channel switches (email-paused / sms-paused tags) — each shuts
// that channel down entirely for this contact.
function channelPaused(tags: string[] | null | undefined, channel: "email" | "sms"): boolean {
  return (tags ?? []).includes(channel === "email" ? "email-paused" : "sms-paused");
}

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

  // Expire finished trial / free-month grants → back to Free, unless the user
  // converted to a paid subscription. Email each downgraded user what changed.
  let downgraded = 0;
  try {
    const downgradedUsers = await expireFreeMonths();
    downgraded = downgradedUsers.length;
    for (const u of downgradedUsers) {
      if (!u.email) continue;
      const tpl = trialEndedEmail({ firstName: u.name?.split(" ")[0] || "there", isTrial: u.wasTrial });
      await resend.emails.send({ ...tpl, to: u.email }).catch(() => {});
    }
  } catch (e) {
    console.error("[reminders] expireFreeMonths failed:", e);
  }

  // Heads-up ~3 days before an app-level Pro grant (trial / free month) ends.
  // For a fresh 14-day trial this lands on day 11. Fires once per expiry value
  // (tracked in customization._proWarnedFor); real subscribers are excluded.
  try {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const in3dIso = new Date(nowMs + 3 * 86400000).toISOString();
    const { data: ending } = await supabase
      .from("profiles")
      .select("id, email, name, plan_expires_at, customization")
      .eq("plan", "pro")
      .is("stripe_subscription_id", null)
      .not("plan_expires_at", "is", null)
      .gt("plan_expires_at", nowIso)
      .lte("plan_expires_at", in3dIso);
    for (const u of ending ?? []) {
      const cust = (u.customization ?? {}) as Record<string, unknown>;
      const expiresAt = u.plan_expires_at as string;
      if (cust._proWarnedFor === expiresAt) continue; // already warned for this expiry
      const daysLeft = Math.max(1, Math.ceil((new Date(expiresAt).getTime() - nowMs) / 86400000));
      if (u.email) {
        const tpl = trialEndingSoonEmail({
          firstName: (u.name as string)?.split(" ")[0] || "there",
          daysLeft,
          isTrial: cust._trial === true,
        });
        await resend.emails.send({ ...tpl, to: u.email as string }).catch(() => {});
      }
      await supabase.from("profiles").update({ customization: { ...cust, _proWarnedFor: expiresAt } }).eq("id", u.id);
    }
  } catch (e) {
    console.error("[reminders] trial-ending warn failed:", e);
  }

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
      // Sender = the CARD's identity; profile = account (plan/settings/owner email).
      const resolved = await resolveCardSender(supabase, username);
      if (!resolved?.profile?.email) continue;
      const { profile, sender } = resolved;
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

      // Send personalized AI follow-up to each lead — AS the card's identity,
      // respecting the contact's per-channel switches (email/text toggles).
      {
        const senderFirst = sender.name?.split(" ")[0] ?? ownerFirst;
        for (const lead of leads) {
          // Which channel would this go out on? Email first, SMS only when the
          // contact has no email. Skip entirely when that channel is switched off.
          const effective: "email" | "sms" | null = lead.email ? "email" : lead.phone ? "sms" : null;
          if (!effective || channelPaused(lead.tags, effective)) continue;

          const leadFirst = lead.name.split(" ")[0];

          const aiPrompt = `${step.leadPrompt(
            sender.name ?? senderFirst,
            sender.title ?? "",
            sender.company ?? "",
            leadFirst,
            lead.message ?? ""
          )}${ownerAbout ? `\n\nWhat I do/offer (reference naturally, speak to the right things): ${ownerAbout}` : ""}`;
          const aiBody = (await aiComplete(aiPrompt, { maxTokens: 200 })) ?? "";

          const emailBody = aiBody || step.leadFallback(senderFirst);
          const customNote = flow.customNote?.trim();
          const fullBody = customNote ? `${emailBody}\n\n${customNote}` : emailBody;

          await deliverToLead({
            leadId: lead.id,
            cardOwner: username,
            lead: { email: lead.email, phone: lead.phone, name: lead.name },
            sender: { name: sender.name, company: sender.company, phone: sender.phone, email: sender.email, website: null },
            text: fullBody,
            cardUsername: username,
            channel: effective,
            email: {
              subject: step.leadSubject(senderFirst),
              html: `
              <div style="background:#ffffff;padding:48px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                <div style="max-width:480px;margin:0 auto;">
                  <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">Hey ${leadFirst},<br/><br/>${fullBody.replace(/\n/g, "<br/>")}</p>
                  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
                    <p style="margin:0 0 6px;font-weight:700;color:#111827;font-size:15px;">${sender.name ?? ""}</p>
                    ${sender.title ? `<p style="margin:0 0 4px;color:#6b7280;font-size:12px;">${sender.title}</p>` : ""}
                    ${sender.company ? `<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">${sender.company}</p>` : ""}
                    ${sender.email ? `<a href="mailto:${sender.email}" style="display:block;color:#2563eb;font-size:13px;margin:0 0 4px;">${sender.email}</a>` : ""}
                    ${sender.phone ? `<a href="tel:${sender.phone}" style="display:block;color:#2563eb;font-size:13px;">${sender.phone}</a>` : ""}
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

  // Resolve each card owner once (identity + plan), cached across their leads.
  const ownerCache = new Map<string, Awaited<ReturnType<typeof resolveCardSender>>>();
  const getOwner = async (username: string) => {
    if (!ownerCache.has(username)) ownerCache.set(username, await resolveCardSender(supabase, username));
    return ownerCache.get(username)!;
  };
  // Notify each downgraded owner at most once per run about paused sequences.
  const seqPausedNotified = new Set<string>();

  for (const seqLead of seqLeads ?? []) {
    const seq = seqLead.follow_up_sequence as { day: number; time?: string; message: string; subject?: string; channel?: string; sent_at: string | null }[] | null;
    if (!seq?.length) continue;
    if ((seqLead.tags ?? []).includes("flow-paused")) continue;

    // Custom follow-up sequences are a Pro feature — only SEND them while the
    // owner is on a paid plan. If they've downgraded, pause (leave the steps
    // unsent so they resume automatically on re-upgrade) and notify the owner
    // once. Nothing is deleted.
    const owner = await getOwner(seqLead.card_owner);
    if (!owner) continue;
    if (!isPaidPlan(owner.profile.plan)) {
      const cust = (owner.profile.customization ?? {}) as Record<string, unknown>;
      if (owner.ownerId && cust._seqPaused !== true && !seqPausedNotified.has(owner.ownerId)) {
        seqPausedNotified.add(owner.ownerId);
        await insertNotification({
          user_id: owner.ownerId,
          type: "sequence_paused",
          title: "Follow-up sequences paused",
          body: "Your automated follow-up sequences are paused because your plan is no longer Pro. Re-upgrade to Pro to resume them — nothing was deleted.",
        }).catch(() => {});
        await supabase.from("profiles").update({ customization: { ...cust, _seqPaused: true } }).eq("id", owner.ownerId);
      }
      continue;
    }

    // Back on a paid plan with sequences flowing again → clear the paused
    // marker so a future downgrade re-notifies.
    {
      const cust = (owner.profile.customization ?? {}) as Record<string, unknown>;
      if (owner.ownerId && cust._seqPaused === true) {
        const { _seqPaused: _drop, ...rest } = cust;
        await supabase.from("profiles").update({ customization: rest }).eq("id", owner.ownerId);
        (owner.profile as { customization?: unknown }).customization = rest; // keep cache coherent
      }
    }

    const createdAt = new Date(seqLead.created_at).getTime();
    // Sender = the CARD's identity (name/company/email of the card this contact
    // came through), so replies go to the right inbox.
    const seqSender = owner.sender;

    for (const item of seq) {
      if (item.sent_at) continue;
      const dueMs = createdAt + item.day * 86400000;
      if (dueMs < todayStart.getTime() || dueMs >= todayEnd.getTime()) continue;
      // Honor the step's scheduled time-of-day (cron runs hourly; send at/after the hour).
      if (item.time) {
        const stepHour = parseInt(item.time.split(":")[0], 10);
        if (!Number.isNaN(stepHour) && currentUTCHour < stepHour) continue;
      }

      const ownerFirst = seqSender.name?.split(" ")[0] ?? "there";
      const leadFirst = (seqLead.name as string).split(" ")[0];

      // Resolve the channel for this item (legacy items without a channel are
      // treated as email when the contact has one, else SMS) — then honor the
      // contact's per-channel switch: a paused channel sends NOTHING.
      const itemChannel: "email" | "sms" =
        item.channel === "sms" ? "sms" : item.channel === "email" ? "email" : (seqLead.email ? "email" : "sms");
      if (channelPaused(seqLead.tags, itemChannel)) continue;
      const asEmail = itemChannel === "email";

      const r = await deliverToLead({
        leadId: seqLead.id,
        cardOwner: seqLead.card_owner,
        lead: { email: seqLead.email, phone: seqLead.phone, name: seqLead.name },
        sender: { name: seqSender.name, company: seqSender.company, phone: seqSender.phone, email: seqSender.email, website: null },
        text: asEmail ? `Hi ${leadFirst},\n\n${item.message}` : item.message,
        subject: item.subject?.trim() || `${ownerFirst} following up`,
        cardUsername: seqLead.card_owner,
        channel: itemChannel,
      });

      // Mark THIS step (matched by day AND channel) done unless it failed
      // transiently — so the email and text flows for the same day don't cancel
      // each other.
      if (r.status === "sent" || r.status === "opted_out" || r.status === "no_contact") {
        const updatedSeq = seq.map((s) =>
          s.day === item.day && (s.channel ?? "email") === (item.channel ?? "email")
            ? { ...s, sent_at: new Date().toISOString() }
            : s
        );
        await supabase.from("leads").update({ follow_up_sequence: updatedSeq }).eq("id", seqLead.id);
        if (r.status === "sent") totalSent++;
      }
    }
  }
  // === END PRESET-BASED SEQUENCE PROCESSING ===

  return NextResponse.json({ sent: totalSent, checkedHour: currentUTCHour, downgraded });
}
