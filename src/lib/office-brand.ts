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
