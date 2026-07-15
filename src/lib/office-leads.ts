import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOfficeUserIds } from "@/lib/office-cards";

// ── Org-wide leads, with attribution that survives member removal ───────────
// Leads are keyed by card slug, and a removed member's slugs drop out of the
// team set — which used to silently delete their leads from the office view the
// moment they were removed, contradicting the removal promise ("the leads they
// captured stay with your company"). At removal time the members route stamps
// each of their existing leads with this tag; the office view is the union of
// current-team leads and tagged leads. Leads the ex-member captures AFTER
// leaving carry no tag, so nothing new leaks to the old employer.

export const officeLeadTag = (officeId: string) => `sc-office-${officeId}`;

export type OfficeLead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
  card_owner: string;
  capturedBy: string; // the PERSON's display name — never a URL slug
  tags: string[] | null;
};

export async function getOfficeLeads(officeId: string): Promise<OfficeLead[]> {
  const admin = getAdminSupabase();
  const teamIds = await getOfficeUserIds(officeId);

  // Slug → display name for everyone on the team (profile handle + card slugs).
  const bySlug = new Map<string, string>();
  let slugs: string[] = [];
  if (teamIds.length) {
    const [{ data: profiles }, { data: cards }] = await Promise.all([
      admin.from("profiles").select("id, username, name").in("id", teamIds),
      admin.from("cards").select("user_id, username, name").in("user_id", teamIds),
    ]);
    const nameByUser = new Map((profiles ?? []).map((p) => [p.id as string, (p.name as string) || ""]));
    for (const p of profiles ?? []) {
      if (p.username) bySlug.set(p.username as string, (p.name as string) || (p.username as string));
    }
    for (const c of cards ?? []) {
      if (!c.username) continue;
      const person = nameByUser.get(c.user_id as string) || (c.name as string) || (c.username as string);
      bySlug.set(c.username as string, person);
    }
    slugs = Array.from(bySlug.keys());
  }

  const select = "id, name, email, phone, status, created_at, card_owner, tags";
  const [current, departed] = await Promise.all([
    slugs.length
      ? admin.from("leads").select(select).in("card_owner", slugs)
          .order("created_at", { ascending: false }).limit(300).then((r) => r.data ?? [])
      : Promise.resolve([]),
    admin.from("leads").select(select).contains("tags", [officeLeadTag(officeId)])
      .order("created_at", { ascending: false }).limit(300).then((r) => r.data ?? []),
  ]);

  const seen = new Set<string>();
  const merged: OfficeLead[] = [];
  for (const row of [...current, ...departed] as Array<Record<string, unknown>>) {
    const id = row.id as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const slug = (row.card_owner as string) ?? "";
    merged.push({
      id,
      name: (row.name as string) || "Unnamed contact",
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      status: (row.status as string | null) ?? null,
      created_at: row.created_at as string,
      card_owner: slug,
      // A departed member's slug isn't in the map — label honestly instead of
      // leaking the slug.
      capturedBy: bySlug.get(slug) ?? "Former team member",
      tags: (row.tags as string[] | null) ?? null,
    });
  }
  merged.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return merged;
}

// How many team leads nobody has worked yet — drives the "new leads waiting"
// item in Needs attention. Counted the same way the Leads tab labels them, so
// the number and the list can never disagree.
export async function getOfficeUncontactedLeadCount(officeId: string): Promise<number> {
  const leads = await getOfficeLeads(officeId);
  return leads.filter((l) => !leadStatusView(l.status).worked).length;
}

// ── Plain-English lead status ────────────────────────────────────────────────
// The app's real status values are new_contact | touch | dissolved (see
// LeadCard.tsx). The old office Leads page colour-coded "hot/warm/closed" —
// values that can never occur, so every row fell through to grey. Map the real
// vocabulary to owner-readable labels, with anything unknown treated as New.

export type LeadStatusLabel = "New" | "Contacted" | "Closed" | "Not interested";

export type LeadStatusView = {
  label: LeadStatusLabel;
  worked: boolean; // has someone on the team already handled this lead?
};

// The stored values the owner can set from the Leads tab. `status` is plain text
// with no CHECK constraint, so this needs no migration — but every value here is
// also renderable by the personal Contacts UI (LeadCard / ContactsClient), so a
// lead marked here never shows up blank there.
export const LEAD_STATUS_VALUES = ["new_contact", "touch", "dissolved", "not_interested"] as const;
export type LeadStatusValue = (typeof LEAD_STATUS_VALUES)[number];

export function isLeadStatusValue(v: string | null | undefined): v is LeadStatusValue {
  return !!v && (LEAD_STATUS_VALUES as readonly string[]).includes(v);
}

export function leadStatusView(status: string | null | undefined): LeadStatusView {
  switch ((status ?? "").toLowerCase()) {
    case "touch":
      return { label: "Contacted", worked: true };
    case "dissolved":
      return { label: "Closed", worked: true };
    case "not_interested":
      return { label: "Not interested", worked: true };
    case "new_contact":
    default:
      return { label: "New", worked: false };
  }
}

// Label → stored value, for the owner-facing status picker.
export const LEAD_STATUS_OPTIONS: { value: LeadStatusValue; label: LeadStatusLabel }[] = [
  { value: "new_contact", label: "New" },
  { value: "touch", label: "Contacted" },
  { value: "dissolved", label: "Closed" },
  { value: "not_interested", label: "Not interested" },
];
