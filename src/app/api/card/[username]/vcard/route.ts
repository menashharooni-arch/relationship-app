import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isCardActive } from "@/lib/card-active";
import { buildVCard, type VCardPhone } from "@/lib/vcard";

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

  const vcard = buildVCard({
    name: str(c.name) ?? username,
    title: str(c.title),
    company: str(c.company),
    email: str(c.email),
    phone: str(c.phone),
    phones: phones.length ? phones : undefined,
    fax: str(custom.fax),
    website: str(c.website),
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
  });

  const slug = (str(c.name) ?? username).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return new NextResponse(vcard, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `inline; filename="${slug || "contact"}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}
