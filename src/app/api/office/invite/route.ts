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
import { INVITE_TTL_MS } from "@/lib/office-invite";
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
  // Optional display name, used only to personalise the email greeting —
  // never stored (office_members has no name column; their profile name is
  // theirs to set when they build their card).
  const inviteeFirst = typeof name === "string" && name.trim() ? name.trim().split(/\s+/)[0] : null;

  // Check for duplicate (case-insensitive — invite emails are stored lowercased).
  const { data: existing } = await admin
    .from("office_members")
    .select("id, status")
    .eq("office_id", office.id)
    .eq("invite_email", email.trim().toLowerCase())
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json({ error: "This person is already a member." }, { status: 400 });
  }

  // Seat gate — only for a NEW invite (a resend reuses a pending row that
  // already reserves its seat). Seats include the owner + active + pending, so
  // this is the hard, server-side reservation that prevents overflow (spec §2/§4).
  if (!existing) {
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
    let member: { invite_token: string } | null = null;
    ({ data: member } = await admin
      .from("office_members")
      .update({ created_at: nowIso, status: "pending", user_id: null, joined_at: null, expires_at: expiresIso })
      .eq("id", existing.id)
      .select("invite_token")
      .maybeSingle());
    if (!member) {
      // Retry without expires_at in case the column isn't there yet.
      ({ data: member } = await admin
        .from("office_members")
        .update({ created_at: nowIso, status: "pending", user_id: null, joined_at: null })
        .eq("id", existing.id)
        .select("invite_token")
        .maybeSingle());
    }
    token = member!.invite_token;
    await writeAudit({ action: "invite.resent", actorId: user.id, orgId: office.id as string, targetId: email.trim().toLowerCase() });
  } else {
    let member: { invite_token: string } | null = null;
    let error: { message: string } | null = null;
    ({ data: member, error } = await admin
      .from("office_members")
      .insert({ office_id: office.id, invite_email: email.trim().toLowerCase(), expires_at: expiresIso })
      .select("invite_token")
      .single());
    if (error) {
      // Retry without expires_at (pre-migration) before giving up.
      ({ data: member, error } = await admin
        .from("office_members")
        .insert({ office_id: office.id, invite_email: email.trim().toLowerCase() })
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
  // from THEIR company, not from us.
  let brandLogoUrl: string | null = null;
  try {
    const brand = await getOfficeBrand(office.id as string);
    brandLogoUrl = brand?.logoUrl ?? null;
  } catch { /* logo is a nicety, never block the invite */ }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: await getMarketingFrom(), // verified domain when set up, safe fallback otherwise
    to: email.trim(),
    subject: `${ownerFirst} invited you to create your ${office.name} digital business card`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
        ${brandLogoUrl
          ? `<img src="${escapeHtml(brandLogoUrl)}" width="48" height="48" alt="" style="border-radius:10px;display:block;margin:0 0 20px;" />`
          : `<div style="margin:0 0 20px;">
               <img src="${APP_URL}/brand-icon.png" width="28" height="28" alt="" style="vertical-align:middle;border-radius:7px;margin-right:8px;" />
               <span style="font-size:14px;font-weight:800;color:#111827;vertical-align:middle;">SwiftCard</span>
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
    `,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
