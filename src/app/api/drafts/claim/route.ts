import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS, isPaidPlan } from "@/lib/plan";
import { getOfficeBrandForUser, overlayOfficeContact } from "@/lib/office-brand";
import { seedDemoContact } from "@/lib/demo-contact";
import {
  buildClaimInsert,
  findClaimedCard,
  isDataUrl,
  parseDataUrl,
  extFromMime,
  ALLOWED_IMAGE_MIME,
  CLAIM_DRAFT_ID_KEY,
  type ClaimInsert,
} from "@/lib/draft-claim";

// Claim converts a guest's localStorage draft into a real `cards` row under the
// SESSION user. It mirrors src/app/api/cards (field allow-list, username +
// customization sanitation, Free card limit, office brand overlay, demo contact
// seed) and additionally uploads any deferred base64 images. It is idempotent:
// a repeat claim of the same draft returns the existing card instead of creating
// a duplicate — critical for double OAuth callbacks / refresh / a second tab.
//
// The row's user_id is ALWAYS the verified session user (buildClaimInsert takes
// it as an argument and ignores anything in the payload) so a draft can never be
// attached to the wrong account.

// sharp (image resizing) needs the Node runtime.
export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, matches the upload route

// Upload a single base64 data URL to the card-uploads bucket under the session
// user (same bucket/path convention as src/app/api/upload/route.ts). Returns the
// public URL, or null if it isn't a usable image.
async function uploadDataUrl(
  admin: ReturnType<typeof getAdminSupabase>,
  userId: string,
  field: string,
  dataUrl: string,
): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  if (!ALLOWED_IMAGE_MIME.includes(parsed.mime)) return null;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(parsed.base64, "base64");
  } catch {
    return null;
  }
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null;

  let body: Buffer = buffer;
  let contentType = parsed.mime;
  let ext = extFromMime(parsed.mime);

  // Resize/compress like the upload route (photos → JPEG, logos → PNG, gifs pass
  // through). Best-effort — fall back to the original on any sharp failure.
  if (parsed.mime !== "image/gif") {
    try {
      const sharp = (await import("sharp")).default;
      const MAXDIM = field === "photo" ? 1000 : 800;
      const img = sharp(buffer).rotate().resize(MAXDIM, MAXDIM, { fit: "inside", withoutEnlargement: true });
      if (field === "logo") {
        body = await img.png({ compressionLevel: 9 }).toBuffer();
        contentType = "image/png";
        ext = "png";
      } else {
        body = await img.jpeg({ quality: 85 }).toBuffer();
        contentType = "image/jpeg";
        ext = "jpg";
      }
    } catch {
      body = buffer;
      contentType = parsed.mime;
      ext = extFromMime(parsed.mime);
    }
  }

  const path = `${userId}/${field}-${Date.now()}.${ext}`;
  const { error } = await admin.storage
    .from("card-uploads")
    .upload(path, body, { contentType, upsert: true });
  if (error) return null;

  const { data } = admin.storage.from("card-uploads").getPublicUrl(path);
  return data.publicUrl ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
  }
  const { draftId, payload, images, step } = body as {
    draftId?: unknown;
    payload?: Record<string, unknown>;
    images?: Record<string, unknown>;
    step?: unknown;
  };

  const safeDraftId = typeof draftId === "string" ? draftId : null;
  const safeStep = typeof step === "number" && Number.isFinite(step) ? step : 1;

  // Read this user's cards once — used for idempotency AND the Free card limit.
  const { data: existingCards } = await admin
    .from("cards")
    .select("id, username, customization")
    .eq("user_id", user.id);

  // ── Idempotency: was this exact draft already claimed? ────────────────────
  const already = findClaimedCard(existingCards ?? [], safeDraftId);
  if (already) {
    // A re-claim of a card that already exists — they've been here before, so
    // this is not a first-time signup (no onboarding plan step).
    return NextResponse.json({ slug: already.username, id: already.id, step: safeStep, first: false });
  }

  // ── Plan gating (mirror api/cards) ────────────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  const paid = isPaidPlan(profile?.plan);
  const count = existingCards?.length ?? 0;

  if (!paid && count >= PLAN_LIMITS.FREE_CARD_LIMIT) {
    return NextResponse.json(
      { error: "limit", message: "Ready for a second card? Go unlimited with Pro.", upgrade: "/pricing" },
      { status: 402 },
    );
  }

  // ── Build the insert (ownership: user_id is ALWAYS this session user) ─────
  const built = buildClaimInsert(user.id, (payload ?? {}) as Record<string, unknown>, paid);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });
  const insert: ClaimInsert = built.insert;

  // ── Upload deferred base64 images ─────────────────────────────────────────
  const imgs = (images ?? {}) as Record<string, unknown>;

  // Logo: from the images map, or a data URL that slipped into logo_url.
  const logoSource = isDataUrl(imgs.logo) ? (imgs.logo as string) : isDataUrl(insert.logo_url) ? insert.logo_url! : null;
  if (logoSource) {
    const url = await uploadDataUrl(admin, user.id, "logo", logoSource);
    insert.logo_url = url; // resolved URL, or null if the upload was rejected
  } else if (isDataUrl(insert.logo_url)) {
    insert.logo_url = null;
  }

  // Headshot: lives on customization.photoUrl (per-card).
  const cust = insert.customization as Record<string, unknown>;
  const photoSource = isDataUrl(imgs.photo)
    ? (imgs.photo as string)
    : isDataUrl(cust.photoUrl)
      ? (cust.photoUrl as string)
      : null;
  if (photoSource) {
    const url = await uploadDataUrl(admin, user.id, "photo", photoSource);
    cust.photoUrl = url;
  } else if (isDataUrl(cust.photoUrl)) {
    cust.photoUrl = null;
  }

  // ── Office uniform branding overlay (mirror api/cards) ────────────────────
  const brand = await getOfficeBrandForUser(user.id);
  if (brand) {
    if (brand.logoUrl) insert.logo_url = brand.logoUrl;
    if (brand.company) insert.company = brand.company;
    if (brand.website) insert.website = brand.website;
    if (brand.lockTemplate && brand.template) insert.template = brand.template;
    if (brand.lockTemplate && brand.template === "custom" && brand.customLayout) cust.customLayout = brand.customLayout;
    // Company phone/fax/address (spec §8).
    if (brand.phone || brand.fax || brand.address) {
      Object.assign(cust, overlayOfficeContact(cust as Record<string, unknown>, brand));
    }
  }

  // Stamp the originating draft id for idempotency on any retry.
  if (safeDraftId) cust[CLAIM_DRAFT_ID_KEY] = safeDraftId;

  // ── Insert ────────────────────────────────────────────────────────────────
  const { data: card, error } = await admin.from("cards").insert(insert).select("id, username").single();

  if (error) {
    if (error.code === "23505") {
      // Username taken. If THIS user already owns a card with it (e.g. a racing
      // duplicate claim), treat the claim as idempotent and return it.
      const { data: mine } = await admin
        .from("cards")
        .select("id, username")
        .eq("user_id", user.id)
        .eq("username", insert.username)
        .maybeSingle();
      if (mine) return NextResponse.json({ slug: mine.username, id: mine.id, step: safeStep, first: count === 0 });
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // First card on the account → seed a sample contact (mirror api/cards).
  if (count === 0) {
    try {
      await seedDemoContact(insert.username);
    } catch {
      /* non-fatal */
    }
  }

  // `first` tells the client this is the account's first card → send them
  // through the onboarding plan-selection step (/welcome) instead of the editor.
  return NextResponse.json({ slug: card.username, id: card.id, step: safeStep, first: count === 0 });
}
