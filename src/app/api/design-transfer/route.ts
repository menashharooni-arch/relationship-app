import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { aiImageEdit, hasImageEditProvider } from "@/lib/ai";
import { isPaidPlan } from "@/lib/plan";
import { isRateLimited } from "@/lib/rate-limit";
import { transferPrompt, transferChecklist, type TransferIdentity } from "@/lib/design-transfer";

// "Make it EXACTLY this design, with my details" — the image-editing sibling
// of /api/scan-design. scan-design reads a photographed card's LAYOUT so the
// block designer can approximate it; this one has the image model REBUILD the
// design itself, carrying the owner's own name/contacts/headshot/logo, and
// returns a stored image for the owner to approve or regenerate. Nothing here
// publishes anything: the client only writes customization.customLayout
// .faceImage after the owner approves the preview.
//
// Same gates as scan-design (auth → Pro → rate limit), tighter rate limit
// because an image generation costs roughly an order of magnitude more than a
// vision read.

const MAX_BASE64 = 10_000_000;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp"]);

// Image generation is slow — a 10s default would kill most calls mid-flight.
export const maxDuration = 60;

/** Owner-controlled URLs are only fetched from our own hosts (SSRF guard —
 *  same allowlist reasoning as wallet-strip.tsx's embedImage). */
function allowedImageHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
    const ok = new Set<string>();
    for (const env of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me"]) {
      if (env) try { ok.add(new URL(env).hostname.toLowerCase()); } catch { /* ignore */ }
    }
    return ok.has(host);
  } catch {
    return false;
  }
}

async function fetchReference(url: unknown): Promise<{ imageBase64: string; mediaType: string } | null> {
  if (typeof url !== "string" || !/^https:\/\//.test(url) || !allowedImageHost(url)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", redirect: "error" }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    if (!/^image\//.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 100 || buf.byteLength > 6_000_000) return null;
    return { imageBase64: buf.toString("base64"), mediaType: type };
  } catch {
    return null;
  }
}

const s = (v: unknown, max = 200): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const adminSupabase = getAdminSupabase();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (!isPaidPlan(profile?.plan)) {
    return NextResponse.json(
      {
        code: "SCAN_DESIGN_PRO_ONLY",
        error: "upgrade",
        message: "Rebuilding a card design with your details is a Pro feature.",
        upgrade: "/pricing",
      },
      { status: 403 },
    );
  }

  // 15/hour: enough for a healthy approve/regenerate loop, not for a script.
  if (await isRateLimited(`design-transfer:${user.id}`, 15, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "You're generating very quickly — give it a minute and try again." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  if (!imageBase64) return NextResponse.json({ error: "no_image" }, { status: 400 });
  if (imageBase64.length > MAX_BASE64) return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  const mediaType = typeof body.mediaType === "string" && ALLOWED_MEDIA.has(body.mediaType)
    ? body.mediaType
    : "image/jpeg";

  // The identity comes from the CLIENT, not the DB row: the designer runs
  // inside an edit form full of unsaved changes, and the face has to show what
  // the form says, not what was last saved. It's the owner describing
  // themselves to their own card — nothing here is trusted anywhere else.
  const id = (body.identity ?? {}) as Record<string, unknown>;
  const identity: TransferIdentity = {
    name: s(id.name, 120) ?? "",
    title: s(id.title, 120),
    company: s(id.company, 120),
    phone: s(id.phone, 40),
    email: s(id.email, 200),
    website: s(id.website, 200),
    address: s(id.address, 300),
  };
  if (!identity.name) return NextResponse.json({ error: "no_name" }, { status: 400 });

  if (!hasImageEditProvider()) return NextResponse.json({ error: "no_ai" }, { status: 503 });

  // The owner's own photo/logo ride along so the model can place them.
  const [headshot, logo] = await Promise.all([
    fetchReference(body.photoUrl),
    fetchReference(body.logoUrl),
  ]);
  identity.hasHeadshot = !!headshot;
  identity.hasLogo = !!logo;

  const result = await aiImageEdit({
    imageBase64,
    mediaType,
    prompt: transferPrompt(identity),
    references: [...(headshot ? [headshot] : []), ...(logo ? [logo] : [])],
  });
  if (!result) return NextResponse.json({ error: "generation_failed" }, { status: 502 });

  // Normalise to the card's own shape and cap the size. cover-crop, not pad:
  // the model was told to keep the canvas, so any drift is slivers at the
  // edges, and bars would read as a broken design.
  let png: Buffer;
  try {
    const sharp = (await import("sharp")).default;
    png = await sharp(result.data)
      .resize(1400, 800, { fit: "cover" })
      .png()
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  // Stored immediately (bucket is public, like every card image): the preview
  // <img> needs a URL either way, and an unapproved file is just an orphan —
  // the same deal the deferred photo/logo uploads already accept.
  const path = `${user.id}/face-${Date.now()}.png`;
  const { error: upErr } = await adminSupabase.storage
    .from("card-uploads")
    .upload(path, png, { contentType: "image/png", upsert: false });
  if (upErr) return NextResponse.json({ error: "storage_failed" }, { status: 502 });
  const { data: pub } = adminSupabase.storage.from("card-uploads").getPublicUrl(path);

  return NextResponse.json({
    url: pub.publicUrl,
    checklist: transferChecklist(identity),
  });
}
