import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOfficeUserIds } from "@/lib/office-cards";
// Used by getOfficeUncontactedLeadCount below. A re-export at the foot of this
// file makes the names available to IMPORTERS, not to this module itself.
import { WORKED_STATUS_VALUES } from "@/lib/lead-status";

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

/** One page of the office's leads, plus the exact total behind it. */
export type OfficeLeadPage = {
  leads: OfficeLead[];
  /** EXACT number of leads this office has, not the number loaded. */
  total: number;
  hasMore: boolean;
};

/** Default page size for the Leads tab. */
export const OFFICE_LEADS_PAGE = 200;

/**
 * The PostgREST filter matching every lead this office can see: one captured
 * by somebody currently on the team, or one stamped with the office tag when
 * its capturer left.
 *
 * Built as a single `or` rather than two queries because the two used to be
 * run separately, each capped at 300, then merged and de-duplicated in memory.
 * That made an exact total impossible, silently truncated at 600, and — worse —
 * meant a lead past the cap could not be found at all, so marking it contacted
 * answered "That lead isn't part of your team."
 *
 * Slugs are [a-z0-9-] by construction (normalizeSlug), so they need no
 * quoting; the tag is our own uuid-derived string.
 */
function officeLeadFilter(slugs: string[], tag: string): string {
  const byTag = `tags.cs.{${tag}}`;
  // `in.()` with an empty list is not valid PostgREST — an office whose members
  // have no slugs yet still has to match its departed-member leads.
  return slugs.length ? `card_owner.in.(${slugs.join(",")}),${byTag}` : byTag;
}

/** Everyone on the team, as slug → the person's display name. */
async function officeSlugMap(officeId: string): Promise<Map<string, string>> {
  const admin = getAdminSupabase();
  const teamIds = await getOfficeUserIds(officeId);
  const bySlug = new Map<string, string>();
  if (!teamIds.length) return bySlug;
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
    // The CARD's name before the account handle: profiles.name is empty for
    // every account created through normal signup.
    const person = nameByUser.get(c.user_id as string) || (c.name as string) || (c.username as string);
    bySlug.set(c.username as string, person);
  }
  return bySlug;
}

export async function getOfficeLeads(
  officeId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<OfficeLeadPage> {
  const admin = getAdminSupabase();
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? OFFICE_LEADS_PAGE)), 500);
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));

  const bySlug = await officeSlugMap(officeId);
  const slugs = Array.from(bySlug.keys());

  const select = "id, name, email, phone, status, created_at, card_owner, tags";
  const { data, count } = await admin
    .from("leads")
    .select(select, { count: "exact" })
    .or(officeLeadFilter(slugs, officeLeadTag(officeId)))
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const leads: OfficeLead[] = (data ?? []).map((row) => {
    const slug = (row.card_owner as string) ?? "";
    return {
      id: row.id as string,
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
    };
  });

  const total = count ?? leads.length;
  return { leads, total, hasMore: offset + leads.length < total };
}

/**
 * Does this office own this lead? The authorization gate for changing a lead's
 * status.
 *
 * One row, matched by id AND the office filter — not "load the list and look
 * for it". That list was capped, so a lead past the cap was genuinely
 * unreachable: the office could see it in an export but marking it contacted
 * answered "That lead isn't part of your team." It also re-ran the entire
 * team resolution plus a 600-row fetch on every single status click.
 */
export async function officeOwnsLead(officeId: string, leadId: string): Promise<boolean> {
  const admin = getAdminSupabase();
  const bySlug = await officeSlugMap(officeId);
  const { data } = await admin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .or(officeLeadFilter(Array.from(bySlug.keys()), officeLeadTag(officeId)))
    .maybeSingle();
  return !!data;
}

/**
 * Every lead the office owns, oldest last, for CSV export. Pages through in
 * blocks rather than taking a cap: an export that silently stops at 600 rows
 * is worse than no export, because nobody can tell it happened.
 */
export async function getAllOfficeLeads(officeId: string, hardCap = 20_000): Promise<OfficeLead[]> {
  const out: OfficeLead[] = [];
  for (let offset = 0; offset < hardCap; offset += 500) {
    const page = await getOfficeLeads(officeId, { limit: 500, offset });
    out.push(...page.leads);
    if (!page.hasMore || !page.leads.length) break;
  }
  return out;
}

// How many team leads nobody has worked yet — drives the "new leads waiting"
// item in Needs attention. Counted the same way the Leads tab labels them, so
// the number and the list can never disagree.
export async function getOfficeUncontactedLeadCount(officeId: string): Promise<number> {
  const admin = getAdminSupabase();
  const bySlug = await officeSlugMap(officeId);
  // An EXACT count, not the length of a capped page. leadStatusView treats
  // anything outside the three worked values — including null — as New, so
  // "uncontacted" is the negation of that set, and the null case has to be
  // spelled out because SQL's `NOT IN` drops nulls.
  const worked = WORKED_STATUS_VALUES.join(",");
  const { count } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .or(officeLeadFilter(Array.from(bySlug.keys()), officeLeadTag(officeId)))
    .or(`status.is.null,status.not.in.(${worked})`);
  return count ?? 0;
}

// ── Plain-English lead status ────────────────────────────────────────────────
// The app's real status values are new_contact | touch | dissolved (see
// ContactsClient.tsx). The old office Leads page colour-coded "hot/warm/closed" —
// values that can never occur, so every row fell through to grey. Map the real
// vocabulary to owner-readable labels, with anything unknown treated as New.

// The status vocabulary now lives in lib/lead-status (client-safe). Re-exported
// so server callers that already import it from here keep working — but a
// CLIENT component must import from "@/lib/lead-status" directly, or it pulls
// this module, and the service-role client, onto its bundle path.
export {
  LEAD_STATUS_VALUES,
  isLeadStatusValue,
  leadStatusView,
  LEAD_STATUS_OPTIONS,
} from "@/lib/lead-status";
export type { LeadStatusLabel, LeadStatusView, LeadStatusValue } from "@/lib/lead-status";
