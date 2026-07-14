import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS } from "@/lib/plan";
import { getOfficeBrand, applyBrandToUserCards } from "@/lib/office-brand";
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

  // Invites expire after 7 days (matches the deadline stated in the invite
  // email) — otherwise a leaked/forwarded link would work indefinitely.
  const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  if (member.created_at && Date.now() - new Date(member.created_at as string).getTime() > INVITE_TTL_MS) {
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

  // Remove any membership this user still holds in a DIFFERENT office first
  // (same as the owner's "Remove member" action). Without this, a user who
  // switches teams keeps an "active" row in their old office forever, and
  // every place that trusts office_members.status as "who's currently on this
  // team" (Team Leads, brand propagation) keeps leaking the old office's data
  // to them / their card to the old office.
  await admin
    .from("office_members")
    .delete()
    .eq("user_id", user.id)
    .eq("status", "active")
    .neq("office_id", officeId);

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

  // Give the joining user enterprise plan + link to office
  await admin
    .from("profiles")
    .update({ plan: "enterprise", office_id: officeId })
    .eq("id", user.id);

  // Uniform branding: the member's EXISTING cards adopt the office brand right
  // away (cards created/edited later already get the overlay in the card APIs).
  try {
    const brand = await getOfficeBrand(officeId);
    if (brand) await applyBrandToUserCards(user.id, brand);
  } catch { /* best-effort — the next card edit applies the overlay anyway */ }

  return NextResponse.json({ ok: true, officeName: (member.offices as { name: string } | null)?.name });
}
