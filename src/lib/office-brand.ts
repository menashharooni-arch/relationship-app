import { getAdminSupabase } from "@/lib/supabase-admin";
import { PRO_CUSTOMIZATION_KEYS } from "@/lib/plan";

export type OfficeAddress = { street?: string; unit?: string; city?: string; state?: string; zip?: string };

// The look an office owns: colors + fonts, set on the office Branding page.
// These are the ONLY customization keys the office overwrites — an employee's
// personal content (photoUrl, bio, links, socials, testimonials) is never touched.
export const OFFICE_DESIGN_KEYS = PRO_CUSTOMIZATION_KEYS;

export type OfficeBrand = {
  logoUrl: string | null;
  company: string | null;
  website: string | null;
  template: string | null;
  customLayout: unknown | null;
  // The locked look (colors + fonts), set on the office Branding page. Applied
  // only while lockTemplate is on — it travels with the template, since a
  // template without its colors/fonts isn't a consistent look.
  design: Record<string, unknown> | null;
  // Company-controlled uniform contact (spec §8) — applied to member cards' data.
  phone: string | null;
  fax: string | null;
  address: OfficeAddress | null;
  // Per-field locks (spec §9). lockTemplate=false lets employees pick their own
  // template AND colors/fonts; true (default) forces the office look. Required
  // contact fields (logo/company/website/phone/fax/address) are ALWAYS
  // company-controlled regardless of this flag.
  lockTemplate: boolean;
};

// Pull just the design keys out of a card's customization blob. Used to seed a
// fresh office's look from the admin's first card (one-time copy).
export function extractDesign(
  customization: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const cust = customization ?? {};
  const design: Record<string, unknown> = {};
  for (const key of OFFICE_DESIGN_KEYS) {
    if (cust[key] !== undefined && cust[key] !== null && cust[key] !== "") design[key] = cust[key];
  }
  return Object.keys(design).length ? design : null;
}

// Returns the office brand for a given office, or null if none is set.
export async function getOfficeBrand(officeId: string | null | undefined): Promise<OfficeBrand | null> {
  if (!officeId) return null;
  const admin = getAdminSupabase();
  // Select the newer columns defensively — a pre-migration schema without them
  // errors, so fall back to the base columns.
  let office: Record<string, unknown> | null = null;
  {
    const { data } = await admin
      .from("offices")
      .select("brand_logo_url, brand_company, brand_website, brand_template, brand_custom_layout, brand_phone, brand_fax, brand_address, brand_locks, brand_design")
      .eq("id", officeId)
      .maybeSingle();
    office = data as Record<string, unknown> | null;
  }
  if (!office) {
    // brand_design missing (pre office-primary-card.sql) — retry without it.
    const { data } = await admin
      .from("offices")
      .select("brand_logo_url, brand_company, brand_website, brand_template, brand_custom_layout, brand_phone, brand_fax, brand_address, brand_locks")
      .eq("id", officeId)
      .maybeSingle();
    office = data as Record<string, unknown> | null;
  }
  if (!office) {
    const { data } = await admin
      .from("offices")
      .select("brand_logo_url, brand_company, brand_website, brand_template, brand_custom_layout")
      .eq("id", officeId)
      .maybeSingle();
    office = data as Record<string, unknown> | null;
  }
  if (!office) return null;

  const addr = office.brand_address as OfficeAddress | null | undefined;
  const hasAddr = !!addr && Object.values(addr).some((v) => (v ?? "").toString().trim());
  const design = (office.brand_design as Record<string, unknown> | null) ?? null;
  const hasDesign = !!design && Object.keys(design).length > 0;
  // A brand is "active" once the admin has set the logo or ANY company field.
  if (!office.brand_logo_url && !office.brand_company && !office.brand_website && !office.brand_template
      && !office.brand_phone && !office.brand_fax && !hasAddr && !hasDesign) {
    return null;
  }
  const locks = (office.brand_locks as { template?: boolean } | null) ?? null;
  return {
    logoUrl: (office.brand_logo_url as string) ?? null,
    company: (office.brand_company as string) ?? null,
    website: (office.brand_website as string) ?? null,
    template: (office.brand_template as string) ?? null,
    customLayout: office.brand_custom_layout ?? null,
    design: hasDesign ? design : null,
    phone: (office.brand_phone as string) ?? null,
    fax: (office.brand_fax as string) ?? null,
    address: hasAddr ? (addr as OfficeAddress) : null,
    lockTemplate: locks?.template !== false, // default true (preserve uniform look)
  };
}

// ── Pure overlay: force the office's locked look (colors + fonts) onto a card's
// customization. Only runs while the template lock is on — an unlocked office
// lets employees pick their own look. The employee's personal content
// (photoUrl, bio, links, socials, …) is never touched, only the design keys.
// Exported for unit testing.
export function overlayOfficeDesign(
  customization: Record<string, unknown> | null | undefined,
  brand: Pick<OfficeBrand, "design" | "lockTemplate">,
): Record<string, unknown> {
  const cust: Record<string, unknown> = { ...(customization ?? {}) };
  if (!brand.lockTemplate || !brand.design) return cust;
  for (const key of OFFICE_DESIGN_KEYS) {
    // Whatever the office set wins; a key the office does NOT define is cleared
    // so an employee can't reintroduce an off-brand colour the office omitted.
    if (brand.design[key] !== undefined) cust[key] = brand.design[key];
    else delete cust[key];
  }
  return cust;
}

// ── Pure overlay: apply the company-controlled contact fields onto a card's
// customization JSON (spec §8). Injects the office phone as a labeled "Office"
// phone entry (marked office:true so it's replaceable/removable), and forces the
// company fax + address. Personal phones and other fields are preserved.
// Exported for unit testing.
type PhoneEntry = { number?: string; label?: string; showOnCard?: boolean; office?: boolean };
export function overlayOfficeContact(
  customization: Record<string, unknown> | null | undefined,
  brand: Pick<OfficeBrand, "phone" | "fax" | "address">,
): Record<string, unknown> {
  const cust: Record<string, unknown> = { ...(customization ?? {}) };
  // Company phone → first entry, labeled Office. Drop any prior office entry.
  const phones = Array.isArray(cust.phones) ? (cust.phones as PhoneEntry[]).filter((p) => !p?.office) : [];
  if (brand.phone && brand.phone.trim()) {
    cust.phones = [{ number: brand.phone.trim(), label: "Office", showOnCard: true, office: true }, ...phones];
  } else {
    cust.phones = phones;
  }
  if (brand.fax != null) cust.fax = brand.fax.trim();
  if (brand.address) cust.address = brand.address;
  return cust;
}

// Remove the company contact overlay from a card's customization (used when a
// member leaves). Only clears fields that still match the office values.
export function stripOfficeContact(
  customization: Record<string, unknown> | null | undefined,
  brand: Pick<OfficeBrand, "phone" | "fax" | "address">,
): Record<string, unknown> {
  const cust: Record<string, unknown> = { ...(customization ?? {}) };
  cust.phones = Array.isArray(cust.phones) ? (cust.phones as PhoneEntry[]).filter((p) => !p?.office) : [];
  if (brand.fax && cust.fax === brand.fax.trim()) cust.fax = "";
  if (brand.address && JSON.stringify(cust.address) === JSON.stringify(brand.address)) delete cust.address;
  return cust;
}

// Resolves the office (as owner OR member) for a user, then its brand.
// Display/read-only surfaces may use this; card WRITES must use
// getMemberBrandForUser below so the owner's own cards stay personal.
export async function getOfficeBrandForUser(userId: string): Promise<OfficeBrand | null> {
  const admin = getAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("office_id").eq("id", userId).maybeSingle();
  let officeId: string | null = (profile?.office_id as string | null) ?? null;
  if (!officeId) {
    const { data: owned } = await admin.from("offices").select("id").eq("owner_id", userId).maybeSingle();
    officeId = (owned?.id as string | null) ?? null;
  }
  return getOfficeBrand(officeId);
}

// The brand to APPLY to a user's cards — MEMBERS ONLY. The office OWNER's
// personal cards are individual to the admin (owner decision, Jul 2026):
// uniform branding governs sub-users' cards, never the admin's own. Returns
// null for the owner so every card-write overlay (create, save, claim,
// profile) leaves their cards untouched.
export async function getMemberBrandForUser(userId: string): Promise<OfficeBrand | null> {
  const admin = getAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("office_id").eq("id", userId).maybeSingle();
  const officeId = (profile?.office_id as string | null) ?? null;
  if (!officeId) return null;
  const { data: office } = await admin.from("offices").select("owner_id").eq("id", officeId).maybeSingle();
  if (((office?.owner_id as string | null) ?? null) === userId) return null; // owner is exempt
  return getOfficeBrand(officeId);
}

// ── Join/leave card sync ──────────────────────────────────────────────────────

// Apply the office brand to every card a user already owns — used when someone
// ACCEPTS an invite. Without this, a member who had cards before joining keeps
// unbranded cards until their next edit, breaking the "one brand across
// everyone" promise for the most common onboarding path.
export async function applyBrandToUserCards(
  userId: string,
  brand: OfficeBrand,
  opts: { setLabel?: boolean } = {},
): Promise<void> {
  const admin = getAdminSupabase();
  const topLevel: Record<string, unknown> = {};
  if (brand.logoUrl) topLevel.logo_url = brand.logoUrl;
  if (brand.company) topLevel.company = brand.company;
  // The card nickname is company-controlled on MEMBER cards, sourced from the
  // company name — every connected card shows the same label on the dashboard.
  // The OWNER keeps their own labels (setLabel:false when propagating to them).
  if (brand.company && opts.setLabel !== false) topLevel.label = brand.company;
  if (brand.website) topLevel.website = brand.website;
  if (brand.lockTemplate && brand.template) topLevel.template = brand.template;

  const hasContact = !!(brand.phone || brand.fax || brand.address);
  // The locked look also lives in customization, so it needs the same per-card
  // read/merge/write path as the contact overlay.
  const hasDesign = !!(brand.lockTemplate && brand.design);
  if (!Object.keys(topLevel).length && !hasContact && !hasDesign) return;

  if (!hasContact && !hasDesign) {
    await admin.from("cards").update(topLevel).eq("user_id", userId).eq("is_office_card", true);
    return;
  }

  // Company contact + locked look live in customization → per-card read/merge/
  // write so the employee's personal fields are preserved. Scoped to cards
  // actually flagged as under the office — a card the user owns that ISN'T
  // part of the office (a separate personal venture) must never be touched.
  const { data: cards } = await admin.from("cards").select("id, customization").eq("user_id", userId).eq("is_office_card", true);
  for (const c of cards ?? []) {
    let merged = c.customization as Record<string, unknown> | null;
    if (hasContact) merged = overlayOfficeContact(merged, brand);
    if (hasDesign) merged = overlayOfficeDesign(merged, brand);
    if (brand.lockTemplate && brand.template === "custom" && brand.customLayout) {
      merged = { ...(merged ?? {}), customLayout: brand.customLayout };
    }
    await admin.from("cards").update({ ...topLevel, customization: merged ?? {} }).eq("id", c.id);
  }
}

// Re-apply the office brand to every ACTIVE MEMBER's cards. The OWNER is
// deliberately excluded: the admin's personal cards are individual to them
// (owner decision, Jul 2026) — an earlier version included the owner here,
// which silently rewrote the admin's own cards with the office template on
// every Branding save. The brand lives on the office row (edited on
// /office/admin/branding) and governs sub-user cards only.
export async function propagateBrandToOfficeCards(officeId: string): Promise<void> {
  const admin = getAdminSupabase();
  const brand = await getOfficeBrand(officeId);
  if (!brand) return;

  const { data: officeRow } = await admin.from("offices").select("owner_id").eq("id", officeId).maybeSingle();
  const ownerId = (officeRow?.owner_id as string | null) ?? null;

  const { data: members } = await admin
    .from("office_members")
    .select("user_id")
    .eq("office_id", officeId)
    .eq("status", "active");

  const seen = new Set<string>();
  const targets: string[] = [];
  for (const m of members ?? []) {
    const uid = m.user_id as string | null;
    if (uid && uid !== ownerId && !seen.has(uid)) { targets.push(uid); seen.add(uid); }
  }

  for (const uid of targets) {
    try {
      await applyBrandToUserCards(uid, brand);
    } catch {
      // Best-effort per user — one bad card must not abort the rest. Their
      // next card edit re-applies the overlay anyway.
    }
  }
}

// One-time brand seed for a freshly provisioned office: copy the owner's OLDEST
// card's identity + look into offices.brand_* so the team doesn't start
// unbranded. A plain COPY — no ongoing link, no primary card. Never overwrites
// a brand the admin has already set (any identity/design field present = no-op);
// from then on the Branding page is the only writer.
export async function seedBrandFromOwnersFirstCard(officeId: string, ownerId: string): Promise<void> {
  const admin = getAdminSupabase();

  const { data: office } = await admin
    .from("offices")
    .select("brand_logo_url, brand_company, brand_website, brand_template, brand_design")
    .eq("id", officeId)
    .maybeSingle();
  if (!office) return;
  const design = office.brand_design as Record<string, unknown> | null;
  const alreadyBranded =
    !!office.brand_logo_url || !!office.brand_company || !!office.brand_website ||
    !!office.brand_template || (!!design && Object.keys(design).length > 0);
  if (alreadyBranded) return;

  const { data: card } = await admin
    .from("cards")
    .select("id, logo_url, company, website, template, customization")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!card) return; // owner has no card yet — the Branding page starts blank

  const cust = (card.customization as Record<string, unknown> | null) ?? {};
  const update: Record<string, unknown> = {
    brand_logo_url: (card.logo_url as string | null) ?? null,
    brand_company: (card.company as string | null) || null,
    brand_website: (card.website as string | null) || null,
    brand_template: (card.template as string | null) || null,
    brand_custom_layout: cust.customLayout ?? null,
    brand_design: extractDesign(cust),
  };

  const { error } = await admin.from("offices").update(update).eq("id", officeId);
  if (error) {
    // brand_design missing (pre-migration schema) — seed what we can.
    delete update.brand_design;
    await admin.from("offices").update(update).eq("id", officeId);
  }

  // NOTE: the seed card is deliberately NOT flagged is_office_card. It used to
  // be — so branding saves kept reaching it — but that made the admin's own
  // card follow the office template forever. The seed is a one-time COPY of
  // the owner's look into the office brand; the owner's cards stay personal.

  await propagateBrandToOfficeCards(officeId);
}

// Strip the office brand from a departing member's cards — used on removal and
// on the webhook cascades. Only clears a field when the card's current value
// MATCHES the office brand (a personal value the member set themselves is
// never wiped); an ex-member must not walk away with the former employer's
// logo/company baked into their live public card.
export async function stripBrandFromUserCards(userId: string, brand: OfficeBrand | null): Promise<void> {
  if (!brand) return;
  const admin = getAdminSupabase();
  if (brand.logoUrl) {
    await admin.from("cards").update({ logo_url: null }).eq("user_id", userId).eq("is_office_card", true).eq("logo_url", brand.logoUrl);
  }
  if (brand.company) {
    await admin.from("cards").update({ company: "" }).eq("user_id", userId).eq("is_office_card", true).eq("company", brand.company);
    await admin.from("cards").update({ label: null }).eq("user_id", userId).eq("is_office_card", true).eq("label", brand.company);
  }
  if (brand.website) {
    await admin.from("cards").update({ website: "" }).eq("user_id", userId).eq("is_office_card", true).eq("website", brand.website);
  }
  // Company contact (phone/fax/address) lives in customization → per-card strip.
  if (brand.phone || brand.fax || brand.address) {
    const { data: cards } = await admin.from("cards").select("id, customization").eq("user_id", userId).eq("is_office_card", true);
    for (const c of cards ?? []) {
      const stripped = stripOfficeContact(c.customization as Record<string, unknown> | null, brand);
      await admin.from("cards").update({ customization: stripped }).eq("id", c.id);
    }
  }
  // template deliberately kept — a card must always have SOME template, and the
  // office's choice is as good a default as any once the brand fields are gone.
}

// ── Managed-field rejection (sub-users only) ─────────────────────────────────
// Given the raw PATCH body an office SUB-USER submitted, list the org-managed
// fields the request tries to CHANGE. A field is a violation only when the
// submitted value differs from BOTH the office brand AND the card's CURRENT
// stored value — i.e. the user actively typed a new off-brand value. Echoing a
// stale value the card already holds (which happens whenever brand propagation
// lagged, e.g. the admin re-enabled the design lock and the design keys hadn't
// been pushed yet) is NOT a violation: it's allowed through and the overlays
// normalize it back to the brand. Without the "differs from both" rule, a
// legitimate personal-field save would be rejected forever on any card whose
// managed values drifted from the brand, with no way for the employee to
// recover. Fields the office left blank are never managed. Design fields count
// only while the office's design lock (lockTemplate) is on.
//
// `current` is the card's stored row (top-level company/website/logo_url/
// template + its customization). Pass {} to fall back to brand-only comparison.
export function findManagedFieldViolations(
  body: Record<string, unknown>,
  brand: OfficeBrand,
  current: { company?: unknown; website?: unknown; logo_url?: unknown; template?: unknown; customization?: Record<string, unknown> | null } = {},
): string[] {
  const out: string[] = [];
  const t = (v: unknown) => (v == null ? "" : String(v).trim());
  const cur = (current.customization ?? {}) as Record<string, unknown>;
  // changed(field, submitted, brandVal, currentVal): only a violation if the
  // submitted value matches neither the brand nor what's already on the card.
  const changed = (submitted: unknown, brandVal: string, currentVal: unknown) =>
    t(submitted) !== brandVal.trim() && t(submitted) !== t(currentVal);

  if (brand.company && "company" in body && changed(body.company, brand.company, current.company)) out.push("company name");
  if (brand.website && "website" in body && changed(body.website, brand.website, current.website)) out.push("website");
  if (brand.logoUrl && "logo_url" in body && changed(body.logo_url, brand.logoUrl, current.logo_url)) out.push("company logo");
  if (brand.lockTemplate && brand.template && "template" in body && changed(body.template, brand.template, current.template)) out.push("card design");
  const cust = body.customization as Record<string, unknown> | undefined;
  if (cust && typeof cust === "object") {
    if (brand.fax && brand.fax.trim() && "fax" in cust && changed(cust.fax, brand.fax, cur.fax)) out.push("fax number");
    if (brand.address && "address" in cust) {
      const a = (cust.address ?? {}) as Record<string, unknown>;
      const b = brand.address as Record<string, unknown>;
      const c = (cur.address ?? {}) as Record<string, unknown>;
      const keys = ["street", "unit", "city", "state", "zip"] as const;
      const diffsBrand = keys.some((k) => t(a[k]) !== t(b[k]));
      const diffsCurrent = keys.some((k) => t(a[k]) !== t(c[k]));
      if (diffsBrand && diffsCurrent) out.push("address");
    }
    if (brand.lockTemplate && brand.design && !out.includes("card design")) {
      for (const key of OFFICE_DESIGN_KEYS) {
        if (brand.design[key] !== undefined && key in cust && changed(cust[key], String(brand.design[key] ?? ""), cur[key])) {
          out.push("card design");
          break;
        }
      }
    }
  }
  return out;
}

// The plan a member should land on when they leave an office: members who had
// (and still have) their OWN Stripe subscription go back to Pro, not free —
// otherwise removing them from a team silently clobbers a subscription they
// are still paying for.
export async function memberFallbackPlan(userId: string): Promise<"pro" | "free"> {
  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", userId)
    .maybeSingle();
  return profile?.stripe_subscription_id ? "pro" : "free";
}
