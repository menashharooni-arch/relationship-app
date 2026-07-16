import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS } from "@/lib/plan";
import { getOfficeBrand, applyBrandToUserCards, stripBrandFromUserCards } from "@/lib/office-brand";
import { isInviteExpired } from "@/lib/office-invite";
import { writeAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

const OFFICE_MIN_SEATS = PLAN_LIMITS.OFFICE_MIN_SEATS;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const admin = getAdminSupabase();

  // Look up the invite (use admin client to bypass RLS for public invite lookup)
  const { data: member } = await admin
    .from("office_members")
    .select("*, offices(id, name, owner_id)")
    .eq("invite_token", token)
    .single();

  if (!member) return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 404 });
  if (member.status === "active") return NextResponse.json({ error: "This invite has already been used." }, { status: 400 });
  if (member.status === "revoked") return NextResponse.json({ error: "This invitation was canceled by the team admin." }, { status: 410 });
  if (member.status === "declined") return NextResponse.json({ error: "This invitation was already declined." }, { status: 410 });

  // Invites expire after 14 days (matches the deadline stated in the invite email)
  // — otherwise a leaked/forwarded link would work indefinitely. Uses stored
  // expires_at when present, else created_at + TTL.
  if (isInviteExpired(member as { status?: string; expires_at?: string | null; created_at?: string | null })) {
    return NextResponse.json({ error: "This invite has expired. Ask the team admin to send a new one." }, { status: 410 });
  }

  // The invite is only valid for the email it was sent to — without this, anyone
  // who obtains the token (forwarded email, leaked link, shared inbox) could
  // accept it under a DIFFERENT account and consume the seat instead of the
  // person actually invited, regardless of whether their own email matches.
  const inviteEmail = (member.invite_email as string | null)?.trim().toLowerCase();
  const userEmail = user.email?.trim().toLowerCase();
  if (inviteEmail && userEmail && inviteEmail !== userEmail) {
    return NextResponse.json(
      { error: `This invite was sent to ${member.invite_email}. Sign in with that email address to accept it.` },
      { status: 403 }
    );
  }

  const officeId = (member.offices as { id: string } | null)?.id ?? member.office_id;

  // Accepting mints enterprise access, so the office's owner must CURRENTLY be
  // on a paid Office plan — the offices row survives a cancel, and a pending
  // invite from a since-cancelled office must not keep granting enterprise.
  const ownerId = (member.offices as { owner_id?: string } | null)?.owner_id;
  if (ownerId) {
    const { data: ownerProfile } = await admin.from("profiles").select("plan").eq("id", ownerId).maybeSingle();
    if (ownerProfile?.plan !== "enterprise") {
      return NextResponse.json(
        { error: "This team's subscription is no longer active. Ask the team admin to reactivate it." },
        { status: 410 }
      );
    }
  }

  // HARD seat guard at accept time. Seats include the OWNER (seat 1) plus active
  // members, so active members may never exceed seats − 1. This is the real
  // overflow guarantee (the invite gate reserves seats, this backstops downgrades
  // and races).
  const { data: officeRow } = await admin.from("offices").select("seats").eq("id", officeId).maybeSingle();
  const seatCap = (officeRow?.seats as number | null) ?? OFFICE_MIN_SEATS;
  const { count: activeCount } = await admin
    .from("office_members")
    .select("*", { count: "exact", head: true })
    .eq("office_id", officeId)
    .eq("status", "active");
  if (1 + (activeCount ?? 0) >= seatCap) {
    return NextResponse.json(
      { error: "This team's seats are all full. Ask the team admin to free up or add a seat." },
      { status: 409 }
    );
  }

  // A profile row must exist BEFORE any mutation below — checked here, not
  // just after activating (the earlier version of this fix rolled back the
  // NEW office's membership on a missing profile, but by then the OLD
  // office's membership row was already hard-deleted a few steps later with
  // no way back, permanently losing the user's original office membership
  // for nothing (code review). Bailing out here, before anything is
  // touched, needs no rollback at all.
  const { data: existingProfile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!existingProfile) {
    return NextResponse.json(
      { error: "Your account isn't fully set up yet. Please finish creating your account, then use the invite link again." },
      { status: 409 }
    );
  }

  // NOTE: any membership this user still holds in a DIFFERENT office is removed
  // AFTER the seat recount below succeeds — never before. Deleting it up front
  // (the old order) meant a seat-race rollback returned 409 having already wiped
  // the user's OLD office row, leaving them with no membership anywhere but a
  // stale profiles.plan='enterprise' + office_id pointing at the old office —
  // permanent unpaid enterprise that no cascade could ever clean up. (office
  // audit H2)

  // Accept: mark active, link user_id
  const { error: updateError } = await admin
    .from("office_members")
    .update({ user_id: user.id, status: "active", joined_at: new Date().toISOString() })
    .eq("id", member.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Count-then-update above isn't atomic — two invitees accepting the LAST
  // seat simultaneously can both pass the pre-check. Recount after activating
  // and, if we overflowed, roll THIS activation back. Self-heals the race
  // instead of leaving active > paid seats.
  const { count: afterCount } = await admin
    .from("office_members")
    .select("*", { count: "exact", head: true })
    .eq("office_id", officeId)
    .eq("status", "active");
  if (1 + (afterCount ?? 0) > seatCap) {
    await admin
      .from("office_members")
      .update({ user_id: null, status: "pending", joined_at: null })
      .eq("id", member.id);
    return NextResponse.json(
      { error: "This team's seats are all full. Ask the team admin to free up or add a seat." },
      { status: 409 }
    );
  }

  // The activation stuck — NOW it's safe to leave the previous office. Capture
  // the old office(s) so we can strip their brand from this user's cards too;
  // otherwise the ex-employer's logo/company/fax/address linger on a card now
  // serving under the new team. (office audit H2/M3)
  const { data: oldRows } = await admin
    .from("office_members")
    .select("office_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .neq("office_id", officeId);
  await admin
    .from("office_members")
    .delete()
    .eq("user_id", user.id)
    .eq("status", "active")
    .neq("office_id", officeId);

  // Give the joining user enterprise plan + link to office. Must verify a
  // profile row actually exists first — an UPDATE silently affects 0 rows if
  // it doesn't (e.g. onboarding hasn't finished provisioning it yet), which
  // would leave the seat we just activated above permanently spent with no
  // enterprise access ever granted, and nothing later reconciles it (auth
  // audit).
  const { data: updatedProfile } = await admin
    .from("profiles")
    .update({ plan: "enterprise", office_id: officeId })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (!updatedProfile) {
    // Roll back the activation — same rollback pattern as the seat-race
    // check above, so the seat isn't silently spent for nothing.
    await admin
      .from("office_members")
      .update({ user_id: null, status: "pending", joined_at: null })
      .eq("id", member.id);
    return NextResponse.json(
      { error: "Your account isn't fully set up yet. Please finish creating your account, then use the invite link again." },
      { status: 409 }
    );
  }

  // Uniform branding: strip any OLD office brand first, then adopt the new one,
  // so switching teams never leaves the previous company's contact details on
  // the card. (cards created/edited later already get the overlay in the APIs.)
  try {
    for (const r of oldRows ?? []) {
      const oldBrand = await getOfficeBrand(r.office_id as string).catch(() => null);
      if (oldBrand) await stripBrandFromUserCards(user.id, oldBrand);
    }
    const brand = await getOfficeBrand(officeId);
    if (brand) await applyBrandToUserCards(user.id, brand);
  } catch { /* best-effort — the next card edit applies the overlay anyway */ }

  await writeAudit({ action: "invite.accepted", actorId: user.id, orgId: officeId, targetId: user.email ?? user.id });

  return NextResponse.json({ ok: true, officeName: (member.offices as { name: string } | null)?.name });
}
