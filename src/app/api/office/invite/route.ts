import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getMarketingFrom } from "@/lib/resend-domain";
import { PLAN_LIMITS } from "@/lib/plan";
import { isRateLimited } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/escape";
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
  // Optional display name: personalises the invite email AND is stored on the
  // office_members row (invite_name) so the admin's Team dashboard can show WHO
  // a pending invite went to, not just the email.
  const inviteName = typeof name === "string" && name.trim() ? name.trim() : null;
  const inviteeFirst = inviteName ? inviteName.split(/\s+/)[0] : null;

  // Check for duplicate (case-insensitive — invite emails are stored lowercased).
  const { data: existing } = await admin
    .from("office_members")
    .select("id, status, expires_at, created_at")
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
      .update({ created_at: nowIso, status: "pending", user_id: null, joined_at: null, expires_at: expiresIso, ...nameField })
      .eq("id", existing.id)
      .select("invite_token")
      .maybeSingle());
    if (!member) {
      // Retry without expires_at in case the column isn't there yet.
      ({ data: member } = await admin
        .from("office_members")
        .update({ created_at: nowIso, status: "pending", user_id: null, joined_at: null, ...nameField })
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
    ({ data: member, error } = await admin
      .from("office_members")
      .insert({ office_id: office.id, invite_email: email.trim().toLowerCase(), expires_at: expiresIso, ...nameField })
      .select("invite_token")
      .single());
    if (error) {
      // Retry without expires_at (pre-migration) before giving up.
      ({ data: member, error } = await admin
        .from("office_members")
        .insert({ office_id: office.id, invite_email: email.trim().toLowerCase(), ...nameField })
        .select("invite_token")
        .single());
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    token = member!.invite_token;
    await writeAudit({ action: "invite.created", actorId: user.id, orgId: office.id as string, targetId: email.trim().toLowerCase() });
  }

  const inviteUrl = `${APP_URL}/join/${token}`;
  const ownerFirst = (ownerProfile?.name ?? "Your team").split(" ")[0];
  // Owner-controlled values escaped before landing in a trusted-brand inbox.
  const safeOwnerFirst = escapeHtml(ownerFirst);
  const safeOfficeName = escapeHtml(office.name);
  const safeInviteeFirst = inviteeFirst ? escapeHtml(inviteeFirst) : null;

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

  const resend = new Resend(process.env.RESEND_API_KEY);
  let emailSent = true;
  const inviteHtml = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
        ${brandLogoUrl
          ? `<img src="${escapeHtml(brandLogoUrl)}" width="56" height="56" alt="${safeOfficeName}" style="border-radius:10px;display:block;margin:0 0 20px;" />`
          : `<div style="margin:0 0 20px;">
               <span style="font-size:20px;font-weight:800;color:#111827;">${safeOfficeName}</span>
             </div>`}
        <h2 style="font-size:22px;font-weight:700;color:#111;margin:0 0 10px;">${safeInviteeFirst ? `${safeInviteeFirst}, you're` : "You're"} invited</h2>
        <p style="color:#444;font-size:15px;line-height:1.5;margin:0 0 24px;">
          ${safeOwnerFirst} invited you to create your <strong>${safeOfficeName}</strong> digital business card.
          It takes 2 minutes.
        </p>
        <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;text-decoration:none;padding:13px 30px;border-radius:100px;font-size:15px;">Create my card →</a>
        <p style="color:#999;font-size:12px;margin-top:28px;">This invite expires in 14 days. If you didn't expect this, you can ignore this email.</p>
        <p style="color:#ccc;font-size:11px;margin:0;">Powered by SwiftCard</p>
      </div>
    `;
  // Plain-text version: the invite greeting + the link, so the mail is
  // multipart/alternative (HTML-only is a spam signal) and works in text-only
  // clients. Uses the unescaped values — text/plain is not HTML.
  const inviteText = [
    `${inviteeFirst ? `${inviteeFirst}, you're` : "You're"} invited`,
    "",
    `${ownerFirst} invited you to create your ${office.name} digital business card. It takes 2 minutes.`,
    "",
    `Create my card: ${inviteUrl}`,
    "",
    "This invite expires in 14 days. If you didn't expect this, you can ignore this email.",
    "Powered by SwiftCard",
  ].join("\n");
  await resend.emails.send({
    from: await getMarketingFrom(), // verified domain when set up, safe fallback otherwise
    to: email.trim(),
    subject: `${ownerFirst} invited you to create your ${office.name} digital business card`,
    html: inviteHtml,
    text: inviteText,
  }).catch(() => { emailSent = false; });

  // `resent` lets the caller tell the truth: there is only ever ONE invite row
  // per (office, email), so re-inviting someone who's already pending re-sends
  // that invitation rather than creating a duplicate. Saying "invite sent" for
  // both would leave an owner wondering why the person has two emails.
  // `emailSent` lets the UI fall back to "copy the invite link" when delivery
  // failed, instead of claiming success. (billing audit #13)
  return NextResponse.json({ ok: true, resent: !!existing, inviteToken: token, emailSent });
}
