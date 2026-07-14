import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { isPaidPlan } from "@/lib/plan";
import { deliverToLead } from "@/lib/messaging";
import { getAccountEmail } from "@/lib/account-email";
import { expireFreeMonths } from "@/lib/referral-server";
import { purgeExpiredDeletedAccounts } from "@/lib/account-purge";
import { applyDueSeatReductions } from "@/lib/office-scheduled-seats";
import { insertNotification } from "@/lib/notify";
import { trialEndingSoonEmail, trialEndedEmail } from "@/lib/email-templates";
import { reportError } from "@/lib/report-error";


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
  // Deleted accounts send NOTHING — no automation may keep emailing/texting
  // a deleted account's contacts. Single choke point for both flows.
  if ((profile.customization as { _deleted?: boolean } | null)?._deleted) return null;
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


export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  // The env var must exist AND match — with it unset, `Bearer undefined` would
  // otherwise pass and expose the whole send-run to anyone.
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = getAdminSupabase();
  const currentUTCHour = new Date().getUTCHours();
  let totalSent = 0;

  // Permanently delete accounts whose 30-day reopen window has passed. This is
  // what makes the "your data is removed for good" promise in the delete
  // dialog / Privacy Policy / Terms actually true (and satisfies Apple's
  // account-deletion requirement). Best-effort — never blocks the send run.
  let purged = 0;
  try {
    purged = await purgeExpiredDeletedAccounts();
  } catch (e) {
    await reportError("reminders.purge-deleted-accounts", e);
  }

  // Apply any Office seat reductions whose billing-period end has passed (spec §5).
  let seatReductionsApplied = 0;
  try {
    seatReductionsApplied = await applyDueSeatReductions();
  } catch (e) {
    await reportError("reminders.apply-seat-reductions", e);
  }

  // Expire finished trial / free-month grants → back to Free, unless the user
  // converted to a paid subscription. Email each downgraded user what changed.
  let downgraded = 0;
  try {
    const downgradedUsers = await expireFreeMonths();
    downgraded = downgradedUsers.length;
    for (const u of downgradedUsers) {
      // Owner-directed mail goes to the ACCOUNT (auth) email, never profiles.email
      // (which can be the card's public contact address).
      const to = await getAccountEmail(u.id, u.email);
      if (!to) continue;
      const tpl = trialEndedEmail({ firstName: u.name?.split(" ")[0] || "there", isTrial: u.wasTrial });
      await resend.emails.send({ ...tpl, to }).catch(() => {});
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
      const to = await getAccountEmail(u.id as string, (u.email as string) ?? null);
      if (to) {
        const tpl = trialEndingSoonEmail({
          firstName: (u.name as string)?.split(" ")[0] || "there",
          daysLeft,
          isTrial: cust._trial === true,
        });
        await resend.emails.send({ ...tpl, to }).catch(() => {});
      }
      await supabase.from("profiles").update({ customization: { ...cust, _proWarnedFor: expiresAt } }).eq("id", u.id);
    }
  } catch (e) {
    console.error("[reminders] trial-ending warn failed:", e);
  }

  // (Removed) The "you haven't shared your card yet" nudge email — users should
  // not receive engagement/reminder emails from SwiftCard.

  // Grace-period expiry: a failed renewal (invoice.payment_failed, in the Stripe
  // webhook) stamps customization._paymentFailedAt and keeps full access for 7
  // days. If payment is still unresolved once that window passes, cancel the
  // Stripe subscription here — Stripe then fires customer.subscription.deleted,
  // and the webhook's existing handler does the actual downgrade (including the
  // Office seat cascade), so there's one single source of truth for that logic
  // rather than duplicating it. A recovered payment clears _paymentFailedAt
  // (invoice.payment_succeeded, in the webhook) before this ever runs.
  try {
    // Filter to rows that actually HAVE the flag set, not every paid profile —
    // this keeps the result well under PostgREST's default page cap regardless
    // of total paid-user count (a plain .in("plan",...) fetch with no filter on
    // the flag itself would silently truncate at scale, letting payment-failed
    // users past the cap keep paid access forever).
    const { data: paidProfiles } = await supabase
      .from("profiles")
      .select("id, plan, customization, stripe_subscription_id")
      .in("plan", ["pro", "enterprise"])
      .not("stripe_subscription_id", "is", null)
      .not("customization->>_paymentFailedAt", "is", null);

    const stripe = getStripe();
    for (const u of paidProfiles ?? []) {
      const cust = (u.customization ?? {}) as Record<string, unknown>;
      const failedAt = cust._paymentFailedAt as string | undefined;
      if (!failedAt) continue;
      if (Date.now() - new Date(failedAt).getTime() < 7 * 86400000) continue; // still within the grace period

      try {
        await stripe.subscriptions.cancel(u.stripe_subscription_id as string);
        // Clear the marker so a FUTURE subscription (if they resubscribe later)
        // starts its own grace period instead of inheriting this expired one.
        const rest = { ...cust };
        delete rest._paymentFailedAt;
        await supabase.from("profiles").update({ customization: rest }).eq("id", u.id);
      } catch (e) {
        // A stuck cancel means a non-paying customer keeps paid access — alert.
        await reportError("reminders.grace-period.cancel", e, { profileId: u.id });
      }
    }
  } catch (e) {
    await reportError("reminders.grace-period.sweep", e);
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
    const seq = seqLead.follow_up_sequence as { day: number; time?: string; message: string; subject?: string; channel?: string; sent_at: string | null; anchor?: string }[] | null;
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
        const rest = { ...cust };
        delete rest._seqPaused;
        await supabase.from("profiles").update({ customization: rest }).eq("id", owner.ownerId);
        (owner.profile as { customization?: unknown }).customization = rest; // keep cache coherent
      }
    }

    const createdAt = new Date(seqLead.created_at).getTime();
    // Sender = the CARD's identity (name/company/email of the card this contact
    // came through), so replies go to the right inbox.
    const seqSender = owner.sender;
    // Optional personal note the owner set (a calendar link, sign-off, etc.),
    // appended to every step of THIS user-built sequence.
    const customNote = ((owner.profile.flow_settings as { customNote?: string } | null)?.customNote ?? "").trim();

    // Working copy that ACCUMULATES sent_at stamps across this run. Stamping
    // against the original `seq` snapshot each time meant that when TWO steps
    // were due in one run (the catch-up case), the second write erased the
    // first step's stamp — and that step re-sent the next day.
    let curSeq = seq;

    for (const item of seq) {
      if (item.sent_at) continue;
      // Skip anything already stamped earlier in THIS run (same day+channel).
      const live = curSeq.find((s) => s.day === item.day && (s.channel ?? "email") === (item.channel ?? "email"));
      if (live?.sent_at) continue;
      // Steps schedule from their anchor (stamped when the sequence was set up)
      // so a flow added to an older contact still sends. Legacy items without an
      // anchor keep the original contact-creation reference.
      const anchorMs = item.anchor ? Date.parse(item.anchor) : NaN;
      const dueMs = (Number.isFinite(anchorMs) ? anchorMs : createdAt) + item.day * 86400000;
      // Send once the step is DUE, on the daily cron run — not gated to an exact
      // hour (a once-a-day cron would otherwise miss most steps). Overdue steps
      // (e.g. a missed cron day, or a flow un-paused) are caught up too; sent_at
      // below marks each step so nothing sends twice.
      if (dueMs >= todayEnd.getTime()) continue;

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
        text: asEmail
          ? `Hi ${leadFirst},\n\n${item.message}${customNote ? `\n\n${customNote}` : ""}`
          : `${item.message}${customNote ? `\n\n${customNote}` : ""}`,
        subject: item.subject?.trim() || `${ownerFirst} following up`,
        cardUsername: seqLead.card_owner,
        channel: itemChannel,
      });

      // Mark THIS step (matched by day AND channel) done unless it failed
      // transiently — so the email and text flows for the same day don't cancel
      // each other. Stamp into the ACCUMULATING copy (not the stale snapshot)
      // and write per-step, so a crash mid-run never re-sends what already went.
      if (r.status === "sent" || r.status === "opted_out" || r.status === "no_contact") {
        curSeq = curSeq.map((s) =>
          s.day === item.day && (s.channel ?? "email") === (item.channel ?? "email")
            ? { ...s, sent_at: new Date().toISOString() }
            : s
        );
        await supabase.from("leads").update({ follow_up_sequence: curSeq }).eq("id", seqLead.id);
        if (r.status === "sent") totalSent++;
      }
    }
  }
  // === END PRESET-BASED SEQUENCE PROCESSING ===

  return NextResponse.json({ sent: totalSent, checkedHour: currentUTCHour, downgraded, purged, seatReductionsApplied });
}
