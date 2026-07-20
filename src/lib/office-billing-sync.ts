import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOfficeBrand, stripBrandFromUserCards, memberFallbackPlan } from "@/lib/office-brand";
import { adoptPrimaryCardForOwner } from "@/lib/office-primary";
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

  // Adopt the owner's earliest card as the office's Primary Card right now, so a
  // freshly-provisioned office is branded from the moment it exists — for BOTH
  // new Office signups and Pro→Office upgrades — instead of only once the admin
  // first opens the console. Idempotent: no-ops once a primary card is set, and
  // the /office/admin guard still backfills as a safety net.
  if (officeId) {
    try { await adoptPrimaryCardForOwner(officeId, ownerId); } catch { /* best-effort — the console backfill covers it */ }
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
