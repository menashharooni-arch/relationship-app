import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isCardActive } from "@/lib/card-active";
import { buildVCard, type VCardPhone, type VCardPhoto } from "@/lib/vcard";
import { cardHeadshot } from "@/lib/card-media";
import { safeFetch } from "@/lib/safe-fetch";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

/**
 * Fetch the card's headshot and base64-encode it for embedding.
 *
 * Server-side twin of the client's fetchHeadshotPhoto: the QR path never runs
 * that browser code, so without this a scanned contact saved with no photo
 * while the same card saved from a phone got one. Best-effort by design — a
 * slow or oversized image omits PHOTO rather than failing the whole save.
 */
// photo_url is an owner-controlled field and this endpoint is PUBLIC and
// unauthenticated, so a plain fetch() here is a server-side request to any
// address the owner cares to name — cloud metadata, an internal Supabase port,
// anything on the deployment's network. safeFetch is the repo's existing guard:
// it rejects non-http(s) schemes, localhost/.internal names, literal private
// IPs, and pins the transport to a validating DNS lookup so a rebinding host
// cannot slip a private address past the pre-check at connect time. It also
// re-validates every redirect hop. Never swap this back to bare fetch().
async function fetchPhoto(url: string): Promise<VCardPhoto | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await safeFetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    // Same ~700KB ceiling the client uses — past that iOS/Android start
    // refusing the .vcf outright, which would break the save entirely.
    if (buf.byteLength > 700_000) return null;
    return { base64: Buffer.from(buf).toString("base64"), mime: type.split(";")[0] };
  } catch {
    return null;
  }
}

// Public vCard for a card, served with a `text/vcard` content type.
//
// WHY: inside the native iOS shell a Blob/anchor download no-ops in WKWebView,
// so SaveContactButton hands the user here via the system browser sheet, where
// iOS renders a real "Add to Contacts" preview. On the web the button keeps its
// existing client-side Blob download (which works there), so nothing about the
// public website changes.
//
// Resolution mirrors src/app/card/[username]/page.tsx (cards row is the source
// of truth, legacy profile-card fallback) and honors the same public
// kill-switch via isCardActive (offline / deleted-owner / plan-limit) so a card
// that isn't publicly live can't be exported here either. buildVCard performs
// RFC-6350 escaping, so visitor/owner-supplied fields can't inject vCard lines.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!username) return NextResponse.json({ error: "Missing card" }, { status: 400 });

  if (!(await isCardActive(username))) {
    return NextResponse.json({ error: "Card not available" }, { status: 404 });
  }

  const admin = getAdminSupabase();
  const { data: cardRow } = await admin.from("cards").select("*").eq("username", username).maybeSingle();
  const source = cardRow
    ?? (await admin.from("profiles").select("*").eq("username", username).maybeSingle()).data;
  if (!source) return NextResponse.json({ error: "Card not available" }, { status: 404 });

  const c = source as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
  const custom = (c.customization ?? {}) as Record<string, unknown>;
  const phones = (Array.isArray(custom.phones) ? custom.phones : [])
    .filter((p): p is VCardPhone => !!(p as VCardPhone)?.number?.trim());
  const addr = (custom.address ?? {}) as Record<string, unknown>;

  // Headshot: the card's own, falling back to the account photo — same
  // resolution the card page uses, so the saved contact shows the same face the
  // scanner just looked at. The owner's row is only read when the card doesn't
  // pin its own photoUrl (see cardHeadshot).
  let photoUrl = cardHeadshot(custom, null);
  if (!photoUrl && cardRow?.user_id) {
    const { data: owner } = await admin
      .from("profiles")
      .select("photo_url")
      .eq("id", cardRow.user_id as string)
      .maybeSingle();
    photoUrl = cardHeadshot(custom, (owner?.photo_url as string | null) ?? null);
  } else if (!photoUrl && !cardRow) {
    photoUrl = (str(c.photo_url) ?? null) as string | null;
  }
  const photo = photoUrl ? await fetchPhoto(photoUrl) : null;

  const vcard = buildVCard(
    {
      name: str(c.name) ?? username,
      title: str(c.title),
      company: str(c.company),
      email: str(c.email),
      phone: str(c.phone),
      phones: phones.length ? phones : undefined,
      fax: str(custom.fax),
      website: str(c.website),
      // Their SwiftCard itself — so the contact keeps a door back to the full
      // card (design, Swift Links, everything a vCard can't hold).
      cardUrl: `${APP_URL}/${username}`,
      address: {
        street: str(addr.street),
        unit: str(addr.unit),
        city: str(addr.city),
        state: str(addr.state),
        zip: str(addr.zip),
      },
      linkedin: str(c.linkedin),
      instagram: str(c.instagram),
      twitter: str(c.twitter),
      tiktok: str(c.tiktok),
    },
    photo,
  );

  const slug = (str(c.name) ?? username).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return new NextResponse(vcard, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `inline; filename="${slug || "contact"}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}
