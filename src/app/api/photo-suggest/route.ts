import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isRateLimited } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
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

type Source = "google" | "gravatar" | "web";
type Candidate = { source: Source; label: string; photoUrl: string };

// unavatar.io aggregates a person's public avatar across many services
// (Gravatar, Google, Twitter/X, GitHub, DuckDuckGo, …) keyed by email. It
// proxies the image directly from its own fixed host — no redirect to an
// arbitrary origin — so importing it is SSRF-safe. fallback=false makes it 404
// when nothing real exists, so we never show a generated placeholder.
function unavatarUrl(email: string | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!e || !e.includes("@")) return null;
  return `https://unavatar.io/${encodeURIComponent(e)}?fallback=false`;
}

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

// `user` is null for a signed-out visitor building a card on the homepage:
// Google's avatar comes from the auth session so it simply isn't available to
// them, but Gravatar and the aggregator are keyed on an EMAIL — which they have
// typed into the builder — so those two sources still work pre-account.
async function resolveCandidates(user: User | null, email: string | undefined): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const g = user ? googlePhotoUrl(user) : null;
  if (g) out.push({ source: "google", label: "Your Google photo", photoUrl: g });
  const gr = gravatarUrl(email);
  if (gr) {
    try {
      const res = await fetch(gr, { method: "HEAD", signal: AbortSignal.timeout(4000) });
      if (res.ok) out.push({ source: "gravatar", label: "Your Gravatar", photoUrl: gr });
    } catch { /* gravatar unreachable — just skip the source */ }
  }
  // Fallback: only reach for the aggregator when the direct sources found
  // nothing (unavatar also checks Gravatar/Google, so this avoids duplicate
  // thumbnails while still catching a Twitter/GitHub/etc. photo they missed).
  if (out.length === 0) {
    const u = unavatarUrl(email);
    if (u) {
      try {
        const res = await fetch(u, { signal: AbortSignal.timeout(5000) });
        const ct = res.headers.get("content-type") ?? "";
        if (res.ok && ct.startsWith("image/")) {
          out.push({ source: "web", label: "Photo from the web", photoUrl: u });
        }
      } catch { /* aggregator unreachable — skip */ }
    }
  }
  return out;
}

// A signed-out visitor may look up an email they typed, so this is throttled
// per IP: the lookup hits third-party hosts (Gravatar/unavatar) and must not
// become an open enumeration proxy. Signed-in users keep a roomier per-user
// budget since the email is their own, from the session.
const GUEST_LOOKUP_LIMIT = 12;   // per IP  / 10 min
const USER_LOOKUP_LIMIT = 60;    // per user / 10 min
const LOOKUP_WINDOW_MS = 10 * 60 * 1000;

// The email to resolve against: ALWAYS the session's own for a signed-in user
// (never client input, so one account can't fish for another's avatar), and the
// typed one only for a guest, who has no session to draw from.
function emailFor(user: User | null, requested: unknown): string | undefined {
  if (user) return user.email;
  return typeof requested === "string" && requested.includes("@") ? requested.trim().toLowerCase() : undefined;
}

// GET → the candidates the user may pick from (previews only, nothing applied).
// ?email= is honoured for guests only (see emailFor).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const key = user ? `photo-suggest:u:${user.id}` : `photo-suggest:ip:${clientIp(req)}`;
  if (await isRateLimited(key, user ? USER_LOOKUP_LIMIT : GUEST_LOOKUP_LIMIT, LOOKUP_WINDOW_MS)) {
    return NextResponse.json({ candidates: [], error: "rate_limited" }, { status: 429 });
  }

  const email = emailFor(user, req.nextUrl.searchParams.get("email"));
  if (!user && !email) return NextResponse.json({ candidates: [] });

  const candidates = await resolveCandidates(user, email);
  return NextResponse.json({ candidates });
}

// POST { source } → import the chosen photo. Re-resolves the URL server-side,
// then downloads, caps, and re-encodes it exactly like a manual upload (same
// pipeline as the LinkedIn import) so the stored file is ours and durable.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const rlKey = user ? `photo-import:u:${user.id}` : `photo-import:ip:${clientIp(req)}`;
  if (await isRateLimited(rlKey, user ? USER_LOOKUP_LIMIT : GUEST_LOOKUP_LIMIT, LOOKUP_WINDOW_MS)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let source: Source | "" = "";
  let requestedEmail: unknown = null;
  try {
    const body = await req.json();
    if (body?.source === "google" || body?.source === "gravatar" || body?.source === "web") source = body.source;
    requestedEmail = body?.email ?? null;
  } catch { /* handled below */ }
  if (!source) return NextResponse.json({ error: "invalid_source" }, { status: 400 });

  const email = emailFor(user, requestedEmail);
  if (!user && !email) return NextResponse.json({ error: "no_photo" }, { status: 404 });

  const candidates = await resolveCandidates(user, email);
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

  // A guest has no account folder to own the file yet. Hand the bytes back as a
  // data: URL, which is precisely what a guest's own cropped upload produces —
  // it rides in the localStorage draft and is uploaded for real at claim time.
  if (!user) {
    return NextResponse.json({ url: `data:image/jpeg;base64,${body.toString("base64")}` });
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
