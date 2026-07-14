import { getAdminSupabase } from "@/lib/supabase-admin";

export type OfficeAddress = { street?: string; unit?: string; city?: string; state?: string; zip?: string };

export type OfficeBrand = {
  logoUrl: string | null;
  company: string | null;
  website: string | null;
  template: string | null;
  customLayout: unknown | null;
  // Company-controlled uniform contact (spec §8) — applied to member cards' data.
  phone: string | null;
  fax: string | null;
  address: OfficeAddress | null;
  // Per-field locks (spec §9). lockTemplate=false lets employees pick their own
  // template; true (default) forces the office template. Required contact fields
  // (logo/company/website/phone/fax/address) are always company-controlled.
  lockTemplate: boolean;
};

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
  // A brand is "active" once the admin has set the logo or ANY company field.
  if (!office.brand_logo_url && !office.brand_company && !office.brand_website && !office.brand_template
      && !office.brand_phone && !office.brand_fax && !hasAddr) {
    return null;
  }
  const locks = (office.brand_locks as { template?: boolean } | null) ?? null;
  return {
    logoUrl: (office.brand_logo_url as string) ?? null,
    company: (office.brand_company as string) ?? null,
    website: (office.brand_website as string) ?? null,
    template: (office.brand_template as string) ?? null,
    customLayout: office.brand_custom_layout ?? null,
    phone: (office.brand_phone as string) ?? null,
    fax: (office.brand_fax as string) ?? null,
    address: hasAddr ? (addr as OfficeAddress) : null,
    lockTemplate: locks?.template !== false, // default true (preserve uniform template)
  };
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

// ── Join/leave card sync ──────────────────────────────────────────────────────

// Apply the office brand to every card a user already owns — used when someone
// ACCEPTS an invite. Without this, a member who had cards before joining keeps
// unbranded cards until their next edit, breaking the "one brand across
// everyone" promise for the most common onboarding path.
export async function applyBrandToUserCards(userId: string, brand: OfficeBrand): Promise<void> {
  const admin = getAdminSupabase();
  const topLevel: Record<string, unknown> = {};
  if (brand.logoUrl) topLevel.logo_url = brand.logoUrl;
  if (brand.company) topLevel.company = brand.company;
  if (brand.website) topLevel.website = brand.website;
  if (brand.lockTemplate && brand.template) topLevel.template = brand.template;

  const hasContact = !!(brand.phone || brand.fax || brand.address);
  if (!Object.keys(topLevel).length && !hasContact) return;

  if (!hasContact) {
    await admin.from("cards").update(topLevel).eq("user_id", userId);
    return;
  }

  // Company contact lives in customization → per-card read/merge/write so
  // personal fields are preserved.
  const { data: cards } = await admin.from("cards").select("id, customization").eq("user_id", userId);
  for (const c of cards ?? []) {
    const merged = overlayOfficeContact(c.customization as Record<string, unknown> | null, brand);
    await admin.from("cards").update({ ...topLevel, customization: merged }).eq("id", c.id);
  }
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
    await admin.from("cards").update({ logo_url: null }).eq("user_id", userId).eq("logo_url", brand.logoUrl);
  }
  if (brand.company) {
    await admin.from("cards").update({ company: "" }).eq("user_id", userId).eq("company", brand.company);
  }
  if (brand.website) {
    await admin.from("cards").update({ website: "" }).eq("user_id", userId).eq("website", brand.website);
  }
  // Company contact (phone/fax/address) lives in customization → per-card strip.
  if (brand.phone || brand.fax || brand.address) {
    const { data: cards } = await admin.from("cards").select("id, customization").eq("user_id", userId);
    for (const c of cards ?? []) {
      const stripped = stripOfficeContact(c.customization as Record<string, unknown> | null, brand);
      await admin.from("cards").update({ customization: stripped }).eq("id", c.id);
    }
  }
  // template deliberately kept — a card must always have SOME template, and the
  // office's choice is as good a default as any once the brand fields are gone.
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
