import { getAdminSupabase } from "@/lib/supabase-admin";

export type OfficeBrand = {
  logoUrl: string | null;
  company: string | null;
  website: string | null;
  template: string | null;
  customLayout: unknown | null;
};

// Returns the office brand for a given office, or null if none is set.
export async function getOfficeBrand(officeId: string | null | undefined): Promise<OfficeBrand | null> {
  if (!officeId) return null;
  const admin = getAdminSupabase();
  const { data: office } = await admin
    .from("offices")
    .select("brand_logo_url, brand_company, brand_website, brand_template, brand_custom_layout")
    .eq("id", officeId)
    .maybeSingle();
  if (!office) return null;
  // A brand is "active" once the admin has set the logo or any brand field.
  if (!office.brand_logo_url && !office.brand_company && !office.brand_website && !office.brand_template) {
    return null;
  }
  return {
    logoUrl: office.brand_logo_url ?? null,
    company: office.brand_company ?? null,
    website: office.brand_website ?? null,
    template: office.brand_template ?? null,
    customLayout: office.brand_custom_layout ?? null,
  };
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
  const update: Record<string, unknown> = {};
  if (brand.logoUrl) update.logo_url = brand.logoUrl;
  if (brand.company) update.company = brand.company;
  if (brand.website) update.website = brand.website;
  if (brand.template) update.template = brand.template;
  if (!Object.keys(update).length) return;
  const admin = getAdminSupabase();
  await admin.from("cards").update(update).eq("user_id", userId);
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
