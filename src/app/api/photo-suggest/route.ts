import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import type { User } from "@supabase/supabase-js";

// sharp needs Node — never edge.
export const runtime = "nodejs";

// ── Profile-photo suggestions from the user's OWN identity ──────────────────
// Sources that need no extra OAuth:
//   google   — the avatar Google handed us at sign-in (auth user_metadata)
//   gravatar — the photo registered for their email at gravatar.com
// (LinkedIn has its own connect/consent flow at /api/integrations/linkedin.)
//
// Every URL is resolved SERVER-side from the signed-in user's identity. The
// client only ever names a source — it can never supply a URL, so this can't
// be used to proxy arbitrary images into our storage.

type Source = "google" | "gravatar";
type Candidate = { source: Source; label: string; photoUrl: string };

function googlePhotoUrl(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const raw =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    "";
  if (!raw) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  // Only trust Google's own CDN — user_metadata is CLIENT-writable via
  // auth.updateUser, so this is attacker-controllable input. Dot-anchored so
  // "evilgoogleusercontent.com" can't slip past the suffix check.
  if (u.protocol !== "https:") return null;
  if (u.hostname !== "googleusercontent.com" && !u.hostname.endsWith(".googleusercontent.com")) return null;
  // Google defaults to a 96px thumb; ask for a card-sized crop.
  return raw.replace(/=s\d+(-c)?$/, "=s400-c");
}

function gravatarUrl(email: string | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return null;
  const hash = createHash("md5").update(e).digest("hex"); // gravatar's spec — not a security use
  // d=404 → a plain 404 when no photo is registered, instead of a placeholder.
  return `https://www.gravatar.com/avatar/${hash}?s=400&d=404`;
}

async function resolveCandidates(user: User): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const g = googlePhotoUrl(user);
  if (g) out.push({ source: "google", label: "Your Google photo", photoUrl: g });
  const gr = gravatarUrl(user.email);
  if (gr) {
    try {
      const res = await fetch(gr, { method: "HEAD", signal: AbortSignal.timeout(4000) });
      if (res.ok) out.push({ source: "gravatar", label: "Your Gravatar", photoUrl: gr });
    } catch { /* gravatar unreachable — just skip the source */ }
  }
  return out;
}

// GET → the candidates the user may pick from (previews only, nothing applied).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const candidates = await resolveCandidates(user);
  return NextResponse.json({ candidates });
}

// POST { source } → import the chosen photo. Re-resolves the URL server-side,
// then downloads, caps, and re-encodes it exactly like a manual upload (same
// pipeline as the LinkedIn import) so the stored file is ours and durable.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let source: Source | "" = "";
  try {
    const body = await req.json();
    if (body?.source === "google" || body?.source === "gravatar") source = body.source;
  } catch { /* handled below */ }
  if (!source) return NextResponse.json({ error: "invalid_source" }, { status: 400 });

  const candidates = await resolveCandidates(user);
  const chosen = candidates.find((c) => c.source === source);
  if (!chosen) return NextResponse.json({ error: "no_photo" }, { status: 404 });

  let body: Buffer;
  try {
    // No redirects: both hosts serve images directly, and following one could
    // hop the download off the allowlisted host.
    const res = await fetch(chosen.photoUrl, { redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`source ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) throw new Error("not an image");
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("too large");
    const sharp = (await import("sharp")).default;
    body = await sharp(bytes).rotate().resize(1000, 1000, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }

  const admin = getAdminSupabase();
  const path = `${user.id}/photo-${source}-${Date.now()}.jpg`;
  const { error: uploadError } = await admin.storage
    .from("card-uploads")
    .upload(path, body, { contentType: "image/jpeg", upsert: true });
  if (uploadError) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("card-uploads").getPublicUrl(path);
  // Deferred like the manual uploader — the caller persists it on card save.
  return NextResponse.json({ url: publicUrl });
}
