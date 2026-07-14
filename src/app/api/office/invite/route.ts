import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getMarketingFrom } from "@/lib/resend-domain";
import { PLAN_LIMITS } from "@/lib/plan";
import { isRateLimited } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/escape";
import { getOfficeSeatUsage } from "@/lib/office-seats";
import { writeAudit } from "@/lib/audit";
import { INVITE_TTL_MS } from "@/lib/office-invite";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cap invite emails per owner — otherwise this endpoint is an unthrottled
  // spam-email relay (loop with different target emails, never accept any).
  if (await isRateLimited(`office-invite:${user.id}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many invites sent — try again in a few minutes." }, { status: 429 });
  }

  // Verify user owns an office
  const { data: office } = await supabase
    .from("offices")
    .select("id, name, seats")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!office) return NextResponse.json({ error: "No office found. Create one first." }, { status: 404 });

  // …AND is currently on a paid Office plan. The offices row survives a
  // subscription cancel; without this recheck a downgraded ex-owner could keep
  // inviting people, and each accept mints a free enterprise account.
  const { data: ownerProfile } = await supabase.from("profiles").select("plan, name").eq("id", user.id).maybeSingle();
  if (ownerProfile?.plan !== "enterprise") {
    return NextResponse.json({ error: "An active Office subscription is required to invite members." }, { status: 403 });
  }

  // Seats is required for the math; fall back to the minimum for legacy rows.
  const seatCap = (office.seats as number | null) ?? PLAN_LIMITS.OFFICE_MIN_SEATS;

  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // Check for duplicate (case-insensitive — invite emails are stored lowercased).
  const { data: existing } = await supabase
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
    ({ data: member } = await supabase
      .from("office_members")
      .update({ created_at: nowIso, status: "pending", user_id: null, joined_at: null, expires_at: expiresIso })
      .eq("id", existing.id)
      .select("invite_token")
      .maybeSingle());
    if (!member) {
      // Retry without expires_at in case the column isn't there yet.
      ({ data: member } = await supabase
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
    ({ data: member, error } = await supabase
      .from("office_members")
      .insert({ office_id: office.id, invite_email: email.trim().toLowerCase(), expires_at: expiresIso })
      .select("invite_token")
      .single());
    if (error) {
      // Retry without expires_at (pre-migration) before giving up.
      ({ data: member, error } = await supabase
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

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: await getMarketingFrom(), // verified domain when set up, safe fallback otherwise
    to: email.trim(),
    subject: `${ownerFirst} invited you to join ${office.name} on SwiftCard`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
        <h2 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px;">You're invited to ${safeOfficeName}</h2>
        <p style="color:#555;margin:0 0 24px;">${safeOwnerFirst} has invited you to join their team on SwiftCard — the digital business card platform. You'll get your own card and access to the team dashboard.</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:100px;font-size:15px;">Accept invitation →</a>
        <p style="color:#999;font-size:12px;margin-top:28px;">This invite expires in 7 days. If you didn't expect this, ignore this email.</p>
        <p style="color:#ccc;font-size:11px;margin:0;">Powered by SwiftCard</p>
      </div>
    `,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
