import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS, isPaidPlan, sanitizeCustomizationForPlan } from "@/lib/plan";
import { getOfficeBrandForUser, overlayOfficeContact, overlayOfficeDesign } from "@/lib/office-brand";
import { seedDemoContact } from "@/lib/demo-contact";
import { normalizeSocial } from "@/lib/social-url";
import { ensureUniqueUsername, normalizeSlug } from "@/lib/username";
import { ensurePrimaryCard, getOwnedOfficeId } from "@/lib/office-primary";
import { getOfficeSubUserContext } from "@/lib/office-roles";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  const { data: profile } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const paid = isPaidPlan(profile?.plan);

  const { count } = await admin
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Free is capped at FREE_CARD_LIMIT cards. Existing cards are never deleted —
  // we only block creating new ones beyond the cap.
  if (!paid && (count ?? 0) >= PLAN_LIMITS.FREE_CARD_LIMIT) {
    return NextResponse.json(
      {
        // Additive machine code for native; web keeps using message/error/upgrade.
        code: "CARD_LIMIT_REACHED",
        error: "limit",
        message: "Ready for a second card? Go unlimited with Pro.",
        upgrade: "/pricing",
      },
      { status: 402 }
    );
  }

  const body = await req.json();
  const { username, name, title, company, phone, email, website, linkedin, instagram, twitter, tiktok, template, customization, logo_url, label, chosenPlan } = body;

  // First-card design preview: a Free account building its FIRST card may have
  // used unlocked Pro colors/custom designer, then explicitly chosen Pro/Office
  // at the in-wizard plan gate — they're headed to checkout next, so keep the
  // design as-designed rather than stripping it here. Safe even before payment
  // completes: the public render always re-sanitizes against the REAL plan, so
  // an abandoned checkout gracefully snaps back to the closest Free look.
  const proIntent = chosenPlan === "pro" || chosenPlan === "office";
  const treatAsPaid = paid || proIntent;

  // Server-side validation (the client validated too, but the API must not
  // accept a card with no name — it renders "Save 's contact" / a blank hero —
  // nor unbounded field lengths. (cards audit M5) Caps are generous so no real
  // card is truncated; they only stop abuse.
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "invalid", message: "A name is required." }, { status: 400 });
  }
  if (name.length > 120) {
    return NextResponse.json({ error: "invalid", message: "That name is too long." }, { status: 400 });
  }

  // The username is ONLY the public URL slug — the account (email/auth user) is
  // the real identity — so a slug collision must never block card creation. We
  // normalize to the safe charset ([a-z0-9-], so it can't break the Supabase
  // `.or()` analytics filters) and auto-pick the next free variant instead of
  // erroring. Fall back to the name, then the email local-part, then "card".
  const slugBase =
    normalizeSlug(String(username ?? "")) ||
    normalizeSlug(String(name ?? "")) ||
    normalizeSlug(String(email ?? "").split("@")[0] || "");
  const normalizedUsername = await ensureUniqueUsername(slugBase, admin);

  // Enforce Free limits on the customization blob (Pro-only colors snapped to
  // the nearest Free preset, link buttons capped) — backend-enforced, not just
  // hidden in the UI.
  let cust = sanitizeCustomizationForPlan((customization ?? {}) as Record<string, unknown>, treatAsPaid, template);
  // Custom designer is Pro-only — Free can't save a "custom" template.
  let safeTemplate = !treatAsPaid && template === "custom" ? "classic-pro" : (template || "classic-pro");

  // Office uniform branding: if the user is under an office with a brand, force
  // the logo, company, website and the whole look — every employee card is based
  // on the admin's primary card. Employees keep only their personal details
  // (name/title/phone/email) and their own content (headshot/bio/personal links).
  let finalCompany = company || "";
  let finalWebsite = website || "";
  let finalLogo = logo_url || null;
  let finalLabel = label || null;
  const brand = await getOfficeBrandForUser(user.id);
  if (brand) {
    if (brand.logoUrl) finalLogo = brand.logoUrl;
    if (brand.company) finalCompany = brand.company;
    if (brand.website) finalWebsite = brand.website;
    // Member cards carry the company-controlled nickname (the company name), so
    // every connected card is labeled consistently. Owners keep their own labels.
    if (brand.company && (await getOfficeSubUserContext(user.id))) finalLabel = brand.company;
    if (brand.lockTemplate && brand.template) safeTemplate = brand.template;
    if (brand.lockTemplate && brand.template === "custom" && brand.customLayout) cust = { ...cust, customLayout: brand.customLayout };
    // Company phone/fax/address (spec §8) — uniform on every member card.
    if (brand.phone || brand.fax || brand.address) cust = overlayOfficeContact(cust, brand);
    // Locked look (colours + fonts) — no-op while the office leaves it unlocked.
    cust = overlayOfficeDesign(cust, brand);
  }

  const cardRow = {
    user_id: user.id,
    name: name || "",
    title: title || "",
    company: finalCompany,
    phone: phone || "",
    email: email || "",
    website: finalWebsite,
    // Server-side normalize (backstop for older/other clients) so whatever
    // was typed — full URL, bare handle, even a spaced name — always stores
    // a linkable value. See lib/social-url.ts.
    linkedin: normalizeSocial(String(linkedin || ""), "linkedin"),
    instagram: normalizeSocial(String(instagram || ""), "instagram"),
    twitter: normalizeSocial(String(twitter || ""), "twitter"),
    tiktok: normalizeSocial(String(tiktok || ""), "tiktok"),
    template: safeTemplate,
    customization: cust,
    logo_url: finalLogo,
    label: finalLabel,
  };

  let { data, error } = await admin
    .from("cards")
    .insert({ ...cardRow, username: normalizedUsername })
    .select()
    .single();

  // Race backstop: another insert grabbed the slug between our check and this
  // write. Regenerate a fresh unique slug and try once more — never surface a
  // "username taken" error, since the slug is disposable and the account owns it.
  if (error?.code === "23505") {
    const retrySlug = await ensureUniqueUsername(`${normalizedUsername}`, admin);
    ({ data, error } = await admin
      .from("cards")
      .insert({ ...cardRow, username: retrySlug })
      .select()
      .single());
  }

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Couldn't create the card." }, { status: 500 });
  }

  // First card on the account → seed a sample contact so the dashboard/contacts
  // aren't empty and the guided tour has a real contact to demonstrate. Use the
  // slug that was actually inserted (may differ from our first pick after a race).
  if ((count ?? 0) === 0) {
    await seedDemoContact(data.username);
  }

  // Office seat 1: the owner's first card becomes the office's PRIMARY card —
  // every employee card is then based on it (logo/company/website/template/look).
  // Only the owner's card can be primary, and only when the slot is still empty.
  try {
    const ownedOfficeId = await getOwnedOfficeId(user.id);
    if (ownedOfficeId) await ensurePrimaryCard(ownedOfficeId, data.id as string);
  } catch {
    // Best-effort: never fail card creation because the brand sync hiccuped.
  }

  return NextResponse.json({ card: data });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: cards } = await admin
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ cards: cards ?? [] });
}
