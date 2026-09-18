import type { getAdminSupabase } from "@/lib/supabase-admin";

// ── Is this visitor someone the owner already knows? ─────────────────────────
//
// The warm-lead feature (docs/plans/warm-lead-alerts.md) names a returning
// visitor: "Priya re-opened your card". A wrong name there costs more trust
// than ten missed ones, so this file answers the question the way a careful
// person would — from evidence the OWNER earned, never from anything the
// visitor's browser volunteered — and when the evidence is mixed it says
// "I don't know".
//
// THE EVIDENCE is a binding in contact_devices: this browser (its sc_vid
// cookie, lib/visit-identity.ts) belongs to this lead, and here is how we
// learned it:
//
//   form     the browser submitted this owner's lead form
//   link     the browser opened a per-contact link the owner sent (PR A5)
//   account  a signed-in SwiftCard viewer whose verified email is the lead's
//
// What is deliberately NOT evidence:
//   • the swiftcard_visitor localStorage blob (device-wide, any owner, and
//     page script can write it) — it keeps powering the hedged "Looks like X"
//     copy it always did (owner decision D10), and never a named alert;
//   • the email/phone fields on a card_events row (client-supplied);
//   • IP address, user agent, or any other fingerprint.
//
// THE RULES:
//   1. One active lead bound to the browser → that lead.
//   2. Several → the same person only if they share an email or phone (they
//      submitted twice); then the newest. Otherwise AMBIGUOUS → anonymous. A
//      family iPad at an open house must never name the wrong person.
//   3. A different person submitting the form on an already-bound browser
//      SUPERSEDES the old binding (the newest submitter owns the browser).
//   4. The owner is never a contact of their own: a lead whose email or phone
//      is the owner's (they tested their own form) is never bound or named.
//
// Never throws. Every failure — including the tables not existing yet because
// supabase/warm-lead-alerts.sql hasn't been applied — degrades to anonymous,
// which is exactly today's behaviour.

type Admin = ReturnType<typeof getAdminSupabase>;

export type BindingSource = "form" | "link" | "account";

export type KnownContact = {
  kind: "known";
  leadId: string;
  name: string;
  /** The card slug the lead was captured on (leads.card_owner). */
  cardOwner: string;
  confidence: BindingSource;
  capturedAt: string;
  status: string | null;
  tags: string[];
  whereMet: string | null;
};

export type ContactResolution = KnownContact | { kind: "anonymous" } | { kind: "ambiguous" };

const ANONYMOUS: ContactResolution = { kind: "anonymous" };

/** The strongest evidence wins when one lead has several bindings to a browser. */
const CONFIDENCE_ORDER: Record<BindingSource, number> = { form: 3, account: 2, link: 1 };

export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.includes("@") ? e : null;
}

/** Last ten digits: "+1 (917) 905-7335" and "9179057335" are one number. */
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = v.replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-10) : null;
}

type PersonKeys = { emails: Set<string>; phones: Set<string> };

function keysOf(rows: { email?: unknown; phone?: unknown }[]): PersonKeys {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const r of rows) {
    const e = normalizeEmail(r.email);
    const p = normalizePhone(r.phone);
    if (e) emails.add(e);
    if (p) phones.add(p);
  }
  return { emails, phones };
}

function sharesKey(a: { email?: unknown; phone?: unknown }, b: { email?: unknown; phone?: unknown }): boolean {
  const ea = normalizeEmail(a.email);
  const pa = normalizePhone(a.phone);
  return (!!ea && ea === normalizeEmail(b.email)) || (!!pa && pa === normalizePhone(b.phone));
}

/** True when the lead is the owner themselves (rule 4). */
export function isOwnersOwnDetails(lead: { email?: unknown; phone?: unknown }, owner: PersonKeys): boolean {
  const e = normalizeEmail(lead.email);
  const p = normalizePhone(lead.phone);
  return (!!e && owner.emails.has(e)) || (!!p && owner.phones.has(p));
}

/** Every email and phone the owner shows anywhere: the profile and each card. */
export async function ownerContactKeys(admin: Admin, ownerId: string): Promise<PersonKeys> {
  try {
    const [{ data: profile }, { data: cards }] = await Promise.all([
      admin.from("profiles").select("email, phone").eq("id", ownerId).maybeSingle(),
      admin.from("cards").select("email, phone").eq("user_id", ownerId),
    ]);
    return keysOf([...(profile ? [profile] : []), ...((cards ?? []) as { email?: unknown; phone?: unknown }[])]);
  } catch {
    return { emails: new Set(), phones: new Set() };
  }
}

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  card_owner: string;
  created_at: string;
  status: string | null;
  tags: string[] | null;
  where_met: string | null;
};

/**
 * The pure decision over the leads a browser is bound to (rules 1, 2 and 4).
 * Exported for tests; resolveKnownContact is the only production caller.
 */
export function decideKnownContact(
  bindings: { lead_id: string; bound_via: BindingSource }[],
  leads: LeadRow[],
  owner: PersonKeys,
): ContactResolution {
  const eligible = leads.filter((l) => !isOwnersOwnDetails(l, owner));
  if (eligible.length === 0) return ANONYMOUS;

  const newest = [...eligible].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  if (eligible.some((l) => l.id !== newest.id && !sharesKey(l, newest))) return { kind: "ambiguous" };

  let confidence: BindingSource | null = null;
  for (const b of bindings) {
    if (b.lead_id !== newest.id) continue;
    if (!confidence || CONFIDENCE_ORDER[b.bound_via] > CONFIDENCE_ORDER[confidence]) confidence = b.bound_via;
  }
  if (!confidence) return ANONYMOUS;

  return {
    kind: "known",
    leadId: newest.id,
    name: (newest.name ?? "").trim(),
    cardOwner: newest.card_owner,
    confidence,
    capturedAt: newest.created_at,
    status: newest.status ?? null,
    tags: Array.isArray(newest.tags) ? newest.tags : [],
    whereMet: newest.where_met ?? null,
  };
}

/** Who is this browser to this owner? */
export async function resolveKnownContact(
  admin: Admin,
  opts: { ownerId: string | null | undefined; visitorId: string | null | undefined },
): Promise<ContactResolution> {
  const { ownerId, visitorId } = opts;
  if (!ownerId || !visitorId) return ANONYMOUS;
  try {
    const { data: bindings, error } = await admin
      .from("contact_devices")
      .select("lead_id, bound_via")
      .eq("owner_id", ownerId)
      .eq("visitor_id", visitorId)
      .is("superseded_at", null)
      .is("wrong_at", null);
    if (error || !bindings?.length) return ANONYMOUS;

    const leadIds = [...new Set(bindings.map((b) => b.lead_id as string))];
    const { data: leads, error: leadsErr } = await admin
      .from("leads")
      .select("id, name, email, phone, card_owner, created_at, status, tags, where_met")
      .in("id", leadIds);
    if (leadsErr || !leads?.length) return ANONYMOUS;

    const owner = await ownerContactKeys(admin, ownerId);
    return decideKnownContact(
      bindings as { lead_id: string; bound_via: BindingSource }[],
      leads as LeadRow[],
      owner,
    );
  } catch {
    return ANONYMOUS;
  }
}

/**
 * Record that the browser which just submitted a lead form belongs to that
 * lead (rule 3 supersedes any other person bound to it; rule 4 skips the
 * owner's own details). Returns what it did, for the caller's log.
 */
export async function bindFormDevice(
  admin: Admin,
  opts: {
    leadId: string;
    ownerId: string;
    visitorId: string;
    email: string | null | undefined;
    phone: string | null | undefined;
  },
): Promise<"bound" | "owner" | "skipped"> {
  const { leadId, ownerId, visitorId, email, phone } = opts;
  if (!leadId || !ownerId || !visitorId) return "skipped";
  try {
    const owner = await ownerContactKeys(admin, ownerId);
    if (isOwnersOwnDetails({ email, phone }, owner)) return "owner";

    // Rule 3: anyone ELSE already bound to this browser for this owner is
    // superseded. The same person re-submitting is left alone — the resolver
    // treats their leads as one person and names the newest.
    const { data: others } = await admin
      .from("contact_devices")
      .select("id, lead_id")
      .eq("owner_id", ownerId)
      .eq("visitor_id", visitorId)
      .is("superseded_at", null)
      .neq("lead_id", leadId);
    if (others?.length) {
      const { data: otherLeads } = await admin
        .from("leads")
        .select("id, email, phone")
        .in("id", others.map((o) => o.lead_id as string));
      const differentPeople = new Set(
        (otherLeads ?? [])
          .filter((l) => !sharesKey(l, { email, phone }))
          .map((l) => l.id as string),
      );
      // A binding whose lead no longer exists is gone by cascade already.
      const toSupersede = others.filter((o) => differentPeople.has(o.lead_id as string)).map((o) => o.id as string);
      if (toSupersede.length) {
        await admin.from("contact_devices").update({ superseded_at: new Date().toISOString() }).in("id", toSupersede);
      }
    }

    // A fresh submission is the strongest evidence there is, so it clears an
    // earlier supersede or "wrong person" mark on this exact pair.
    const { error } = await admin.from("contact_devices").upsert(
      {
        lead_id: leadId,
        owner_id: ownerId,
        visitor_id: visitorId,
        bound_via: "form",
        bound_at: new Date().toISOString(),
        superseded_at: null,
        wrong_at: null,
      },
      { onConflict: "lead_id,visitor_id" },
    );
    return error ? "skipped" : "bound";
  } catch {
    return "skipped";
  }
}

/** Stamp the binding as seen. Fire-and-forget; never throws. */
export async function touchContactDevice(
  admin: Admin,
  opts: { ownerId: string; visitorId: string; leadId: string },
): Promise<void> {
  try {
    await admin
      .from("contact_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("owner_id", opts.ownerId)
      .eq("visitor_id", opts.visitorId)
      .eq("lead_id", opts.leadId);
  } catch {
    /* best effort */
  }
}
