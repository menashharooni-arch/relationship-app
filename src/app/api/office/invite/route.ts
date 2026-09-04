import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { sendRawEmail, isOptedOut, contactUnsubUrl } from "@/lib/messaging";
import { buildInviteEmail } from "@/lib/office-invite-email";
import { APP_STORE_URL } from "@/lib/app-store";
import { PLAN_LIMITS } from "@/lib/plan";
import { isRateLimited } from "@/lib/rate-limit";
import { getOfficeSeatUsage } from "@/lib/office-seats";
import { writeAudit } from "@/lib/audit";
import { INVITE_TTL_MS, isInviteExpired } from "@/lib/office-invite";
import { requireOfficeCapability } from "@/lib/office-roles";
import { getOfficeBrand } from "@/lib/office-brand";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cap invite emails per caller — otherwise this endpoint is an unthrottled
  // spam-email relay (loop with different target emails, never accept any).
  if (await isRateLimited(`office-invite:${user.id}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many invites sent — try again in a few minutes." }, { status: 429 });
  }

  // Server-side authorization: the caller must have the invite_members capability
  // in an office (owner or admin). Never trust the UI. Returns the office context.
  const ctx = await requireOfficeCapability(user.id, "invite_members");
  if (!ctx) return NextResponse.json({ error: "You don't have permission to invite members." }, { status: 403 });

  const admin = getAdminSupabase();
  const { data: office } = await admin
    .from("offices")
    .select("id, name, seats")
    .eq("id", ctx.officeId)
    .maybeSingle();
  if (!office) return NextResponse.json({ error: "No office found. Create one first." }, { status: 404 });

  // The office OWNER must currently be on a paid Office plan (the offices row
  // survives a cancel; without this a downgraded team could keep minting
  // enterprise). Also fetch the owner's name for the invite email brand.
  const { data: ownerProfile } = await admin.from("profiles").select("plan, name").eq("id", ctx.ownerId).maybeSingle();
  if (ownerProfile?.plan !== "enterprise") {
    return NextResponse.json({ error: "An active Office subscription is required to invite members." }, { status: 403 });
  }

  // Seats is required for the math; fall back to the minimum for legacy rows.
  const seatCap = (office.seats as number | null) ?? PLAN_LIMITS.OFFICE_MIN_SEATS;

  const { email, name } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // Suppression gate — the same one every other send to a third party passes
  // through (scanner/send, leads/share-card). Mailing an address that already
  // said stop is the highest-yield way to earn a spam complaint, and it breaks
  // the one-click unsubscribe this email now advertises. Checked BEFORE any row
  // is written so a suppressed address never consumes a seat.
  if (await isOptedOut("email", email)) {
    return NextResponse.json(
      {
        error: "opted_out",
        message: "This person has unsubscribed from SwiftCard emails, so we can't email them. You can still add them and share the invite link directly.",
      },
      { status: 409 },
    );
  }
  // Optional display name: personalises the invite email AND is stored on the
  // office_members row (invite_name) so the admin's Team dashboard can show WHO
  // a pending invite went to, not just the email.
  const inviteName = typeof name === "string" && name.trim() ? name.trim() : null;
  const inviteeFirst = inviteName ? inviteName.split(/\s+/)[0] : null;

  // Check for duplicate (case-insensitive — invite emails are stored lowercased).
  const { data: existing } = await admin
    .from("office_members")
    // invited_at — office_members has no created_at, and naming a missing column
    // fails the whole select, which made this duplicate check silently return
    // nothing (so a resend looked like a brand-new invite).
    .select("id, status, expires_at, invited_at")
    .eq("office_id", office.id)
    .eq("invite_email", email.trim().toLowerCase())
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json({ error: "This person is already a member." }, { status: 400 });
  }

  // Seat gate — required for a NEW invite AND for a resend that would newly
  // consume a seat. A *live* pending row already reserves its seat, but a
  // revoked/declined/expired row does NOT count in getOfficeSeatUsage, so
  // re-inviting one is effectively a new reservation and must pass the gate —
  // otherwise the owner could over-reserve past their purchased seats.
  // NOTE: an EXPIRED-but-unswept pending is still status='pending' yet is
  // excluded from the usage count, so it must be gated too — use the SAME
  // isInviteExpired() check the usage counter uses. (billing audit #5)
  const isPendingReservation = existing?.status === "pending" && !isInviteExpired(existing);
  if (!existing || !isPendingReservation) {
    const usage = await getOfficeSeatUsage(office.id as string, seatCap);
    if (usage.available <= 0) {
      return NextResponse.json(
        {
          error: "no_seats",
          message: `You've used all ${usage.purchased} seats (you + ${usage.active} active + ${usage.pending} pending). Add a seat to invite this employee.`,
          usage,
        },
        { status: 409 }
      );
    }
  }

  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  // Upsert: re-send invite if a row already exists.
  let token: string;
  if (existing) {
    // Resend: restart the acceptance window AND flip the status back to 'pending'
    // so a previously revoked/declined/expired invite becomes live again (and the
    // same email can always be re-invited). expires_at is best-effort (column may
    // not exist pre-migration — an unknown-column error just leaves it null and
    // the join route falls back to created_at + TTL).
    // Only overwrite the stored name when this invite carries one, so a plain
    // "Remind" (no name) never blanks the name shown on the dashboard.
    const nameField = inviteName ? { invite_name: inviteName } : {};
    let member: { invite_token: string } | null = null;
    ({ data: member } = await admin
      .from("office_members")
      .update({ invited_at: nowIso, status: "pending", user_id: null, joined_at: null, expires_at: expiresIso, ...nameField })
      .eq("id", existing.id)
      .select("invite_token")
      .maybeSingle());
    if (!member) {
      // Retry without expires_at in case the column isn't there yet.
      ({ data: member } = await admin
        .from("office_members")
        .update({ invited_at: nowIso, status: "pending", user_id: null, joined_at: null, ...nameField })
        .eq("id", existing.id)
        .select("invite_token")
        .maybeSingle());
    }
    token = member!.invite_token;
    await writeAudit({ action: "invite.resent", actorId: user.id, orgId: office.id as string, targetId: email.trim().toLowerCase() });
  } else {
    let member: { invite_token: string } | null = null;
    let error: { message: string } | null = null;
    const nameField = inviteName ? { invite_name: inviteName } : {};
    // role is written EXPLICITLY. The column's historical default was 'member',
    // which is not one of OfficeRole (owner|admin|manager|billing_admin|
    // employee) — resolveOfficeContext coerced it to "employee", so it behaved
    // correctly, but only because of that one fallback line. Storing the real
    // value means the database and the capability map agree, instead of every
    // existing member's permissions hinging on an unrecognised string.
    ({ data: member, error } = await admin
      .from("office_members")
      .insert({ office_id: office.id, invite_email: email.trim().toLowerCase(), role: "employee", expires_at: expiresIso, ...nameField })
      .select("invite_token")
      .single());
    if (error) {
      // Retry without expires_at (pre-migration) before giving up.
      ({ data: member, error } = await admin
        .from("office_members")
        .insert({ office_id: office.id, invite_email: email.trim().toLowerCase(), role: "employee", ...nameField })
        .select("invite_token")
        .single());
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    token = member!.invite_token;
    await writeAudit({ action: "invite.created", actorId: user.id, orgId: office.id as string, targetId: email.trim().toLowerCase() });
  }

  const inviteUrl = `${APP_URL}/join/${token}`;
  const ownerFirst = (ownerProfile?.name ?? "Your team").split(" ")[0];

  // Company logo when branding is set — the email should look like it comes
  // from THEIR company, not from us. If the Branding page has no logo yet, fall
  // back to the OWNER's own card logo (the same mark their cards already carry)
  // so a team that never opened Branding still gets a branded invite.
  let brandLogoUrl: string | null = null;
  try {
    const brand = await getOfficeBrand(office.id as string);
    brandLogoUrl = brand?.logoUrl ?? null;
    if (!brandLogoUrl) {
      const { data: ownerCard } = await admin
        .from("cards")
        .select("logo_url")
        .eq("user_id", ctx.ownerId)
        .not("logo_url", "is", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      brandLogoUrl = (ownerCard?.logo_url as string | null) ?? null;
    }
  } catch { /* logo is a nicety, never block the invite */ }

  // contactUnsubUrl throws when no signing secret is configured (deliberate
  // fail-closed on SIGNING — never sign with a public constant). Degrade to "no
  // unsubscribe link in the body" rather than blocking the invite; sendRawEmail
  // makes the same call for the header and degrades the same way.
  let inviteUnsubUrl: string | null = null;
  try {
    inviteUnsubUrl = contactUnsubUrl(email.trim());
  } catch {
    inviteUnsubUrl = null;
  }

  const invite = buildInviteEmail({
    ownerFirst,
    officeName: office.name as string,
    inviteeFirst,
    inviteUrl,
    brandLogoUrl,
    unsubscribeUrl: inviteUnsubUrl,
    // Self-activating: null while the iOS app is in review, the App Store
    // badge the moment the listing is live (same switch as the whole site).
    appStoreUrl: APP_STORE_URL,
  });

  // Through the shared layer rather than a second resend.emails.send() call.
  // This was the ONLY send site in the app that bypassed sendRawEmail, which is
  // exactly why it was the only one missing the personalised From, a Reply-To,
  // the RFC 8058 one-click headers, and a text part guaranteed to match the HTML.
  // A divergent second send site is the defect; centralising is the fix.
  const sendResult = await sendRawEmail({
    to: email.trim(),
    subject: invite.subject,
    html: invite.html,
    fromName: invite.fromName,
    // A named colleague is being invited to a workspace — transactional, and it
    // has to reach the inbox to be actionable. List-Unsubscribe would both file
    // it under Promotions and let a one-click opt-out land the invitee in
    // message_opt_outs, silently blocking the resend they'd then ask for.
    personal: true,
    // A team invitation is the platform writing to a stranger on a customer's
    // behalf: support@ carries it, and the inviter's own address is the
    // Reply-To below so "who are you?" reaches the person who can answer.
    sender: "support",
    // The inviting admin's verified auth email — from supabase.auth.getUser(),
    // never a free-text profile field. Gives a stranger a real mailbox to reply
    // to, which is the strongest positive signal a receiver can observe.
    replyTo: user.email ?? null,
  });
  const emailSent = sendResult === "sent";

  // `resent` lets the caller tell the truth: there is only ever ONE invite row
  // per (office, email), so re-inviting someone who's already pending re-sends
  // that invitation rather than creating a duplicate. Saying "invite sent" for
  // both would leave an owner wondering why the person has two emails.
  // `emailSent` lets the UI fall back to "copy the invite link" when delivery
  // failed, instead of claiming success. (billing audit #13)
  return NextResponse.json({ ok: true, resent: !!existing, inviteToken: token, emailSent });
}
