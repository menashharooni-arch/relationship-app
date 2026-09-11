import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOfficeBrand, stripBrandFromUserCards, memberFallbackPlan , seedBrandFromOwnersFirstCard } from "@/lib/office-brand";
import { insertNotification } from "@/lib/notify";

type Admin = ReturnType<typeof getAdminSupabase>;

// Shared notification copy for every "your Office access ended" path (this
// teardown, the seat-trim cascade, and the subscription-cancellation cascade
// in the webhook) — one place to word it, and correctly reflects the ACTUAL
// fallback plan instead of always claiming "Free" (code review: a member
// with their own live Pro subscription falls back to "pro", not "free", and
// telling them they lost paid access they still have is simply false).
export function officeAccessEndedMessage(fallback: "pro" | "free"): string {
  return fallback === "pro"
    ? "Your team's Office plan changed, so your account reverted to your own Pro plan. Nothing was deleted — reach out to your team admin if this was unexpected."
    : "Your team's Office plan changed, so your account moved to a Free plan. Nothing was deleted — reach out to your team admin if this was unexpected.";
}

// ── Office provisioning/teardown reconciler ─────────────────────────────────
// Shared by the in-app change-plan route AND the customer.subscription.updated
// webhook. A Pro<->Office swap made through the Stripe billing portal (rather
// than our in-app flow) fires only the webhook — before this existed, only
// change-plan provisioned/tore down the office row, so a portal-initiated
// Office->Pro downgrade left every member with unpaid enterprise access
// indefinitely, and a portal-initiated Pro->Office upgrade never created the
// office row at all (billing audit).

// Provision (create or update) the office row for an owner who just became —
// or already is — Office/enterprise on Stripe.
export async function provisionOfficeForOwner(admin: Admin, ownerId: string, seats: number): Promise<void> {
  const { data: existing } = await admin.from("offices").select("id").eq("owner_id", ownerId).maybeSingle();
  let officeId: string | null = null;
  if (existing) {
    await admin.from("offices").update({ seats }).eq("id", existing.id);
    officeId = existing.id as string;
  } else {
    const { data: prof } = await admin.from("profiles").select("name, company").eq("id", ownerId).maybeSingle();
    const officeName = (prof?.company as string | null) || (prof?.name ? `${prof.name}'s Team` : "My Office");
    const { data: created } = await admin
      .from("offices")
      .insert({ owner_id: ownerId, name: officeName, seats })
      .select("id")
      .maybeSingle();
    officeId = (created?.id as string | null) ?? null;
  }

  // Seed the brand from the owner's earliest card right now, so a freshly-
  // provisioned office is branded from the moment it exists — for BOTH new
  // Office signups and Pro→Office upgrades. Idempotent: no-ops the moment any
  // brand identity is set; the /office/admin guard self-heals as a safety net.
  if (officeId) {
    try { await seedBrandFromOwnersFirstCard(officeId, ownerId); } catch { /* best-effort — the console self-heal covers it */ }
    try { await restoreSuspendedMembers(admin, officeId, seats); } catch { /* best-effort — the team can always be re-invited */ }
  }
}

/**
 * Bring a suspended roster back when an office starts paying again.
 *
 * A lapsed subscription (or a seat cut) leaves members at status 'suspended'
 * rather than deleting them — see releaseOfficeMember in the Stripe webhook.
 * This is the other half of that promise: re-subscribing restores the team
 * instead of making the owner re-invite fourteen people one at a time.
 *
 * FOUR RULES, each of which would otherwise be a bug:
 *
 *  • Capacity. Restore at most `seats − 1 − (already active) − (pending)`. An
 *    owner who comes back on fewer seats than they left with must not end up
 *    over capacity, which would put the seat gate into a state the UI cannot
 *    explain.
 *  • Oldest first, by joined_at — the same ordering the seat trim uses to
 *    decide who goes, so coming back is the exact inverse of leaving.
 *  • Never steal someone. A suspended member who has since joined ANOTHER
 *    office is skipped; their active membership there wins.
 *  • Plan and office_id are restored too. The cascade set them to free/null,
 *    and a membership row without them is a member who cannot use anything.
 *
 * The brand is deliberately NOT re-pushed here: the owner may have changed it
 * while lapsed, and propagation belongs to the Branding page, which is one
 * click away and shows what it is about to do.
 */
async function restoreSuspendedMembers(admin: Admin, officeId: string, seats: number): Promise<void> {
  const { data: suspended } = await admin
    .from("office_members")
    .select("id, user_id, joined_at")
    .eq("office_id", officeId)
    .eq("status", "suspended")
    .not("user_id", "is", null)
    .order("joined_at", { ascending: true });
  if (!suspended?.length) return;

  const [{ count: activeCount }, { count: pendingCount }] = await Promise.all([
    admin.from("office_members").select("*", { count: "exact", head: true }).eq("office_id", officeId).eq("status", "active"),
    admin.from("office_members").select("*", { count: "exact", head: true }).eq("office_id", officeId).eq("status", "pending"),
  ]);
  // The owner always holds seat 1.
  let room = Math.max(0, seats - 1 - (activeCount ?? 0) - (pendingCount ?? 0));
  if (room <= 0) return;

  // Anyone already active in a different office keeps that membership.
  const ids = suspended.map((m) => m.user_id as string);
  const { data: elsewhere } = await admin
    .from("office_members")
    .select("user_id")
    .in("user_id", ids)
    .eq("status", "active")
    .neq("office_id", officeId);
  const taken = new Set((elsewhere ?? []).map((r) => r.user_id as string));

  for (const m of suspended) {
    if (room <= 0) break;
    const uid = m.user_id as string;
    if (taken.has(uid)) continue;
    const { error } = await admin.from("office_members").update({ status: "active" }).eq("id", m.id);
    if (error) continue;
    await admin.from("profiles").update({ plan: "enterprise", office_id: officeId }).eq("id", uid);
    room--;
  }
}

// Tear down an owner's office: release every active member back to their own
// plan, strip the office brand from their cards, notify each of them, delete
// office_members, then the office row itself.
export async function tearDownOfficeForOwner(admin: Admin, ownerId: string): Promise<void> {
  const { data: office } = await admin.from("offices").select("id").eq("owner_id", ownerId).maybeSingle();
  if (!office) return;
  const brand = await getOfficeBrand(office.id).catch(() => null);
  const { data: members } = await admin
    .from("office_members")
    .select("user_id")
    .eq("office_id", office.id)
    .not("user_id", "is", null);
  for (const m of members ?? []) {
    if (m.user_id) {
      const fallback = await memberFallbackPlan(m.user_id as string);
      await admin.from("profiles").update({ plan: fallback, office_id: null, plan_expires_at: null }).eq("id", m.user_id as string);
      await stripBrandFromUserCards(m.user_id as string, brand).catch(() => {});
      await insertNotification({
        user_id: m.user_id as string,
        type: "office_plan_downgraded",
        title: "Your Office access ended",
        body: officeAccessEndedMessage(fallback),
      }).catch(() => {});
    }
  }
  await admin.from("office_members").delete().eq("office_id", office.id);
  await admin.from("offices").delete().eq("id", office.id);
}
