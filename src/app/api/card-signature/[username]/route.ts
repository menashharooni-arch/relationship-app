import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";
const BUCKET = "card-signatures";

// THE signature image URL for a card — the one every outgoing email embeds.
//
// WHY A ROUTE AND NOT THE STORAGE URL: the stored PNG is written only when the
// owner opens Preview & copy, and it is DELETED on every card edit that changes
// how the signature looks (api/cards/[id] and the office equivalent). So the
// bucket object is missing far more often than it is present — right after any
// edit, and always for an owner who never opened that screen. Emailing the
// storage URL directly meant two visible failures: a share email with a grey
// name-only box instead of the card, and — worse — ALREADY-DELIVERED mail
// turning into a broken-image icon the moment the owner edited their card.
//
// This route resolves at fetch time and always lands on a real picture of the
// card: the owner's stored signature when it exists, the card's live
// opengraph render (which is generated on demand and cannot 404) when it
// doesn't. One stable URL, safe to put in mail that outlives any edit.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: raw } = await params;
  // The URL ends in .png so mail clients and image proxies see an image;
  // the slug itself never contains a dot.
  const slug = decodeURIComponent(raw).replace(/\.png$/i, "").toLowerCase();
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) {
    return NextResponse.json({ error: "bad username" }, { status: 400 });
  }

  const live = `${APP_URL}/${slug}/opengraph-image`;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let target = live;

  if (base) {
    const stored = `${base}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(slug)}.png`;
    try {
      // HEAD, not GET: we only need to know it's there, and this runs on the
      // recipient's image fetch, not on the send path.
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(stored, { method: "HEAD", signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (res.ok) target = stored;
    } catch {
      /* storage unreachable — the live render is a complete answer */
    }
  }

  // Short cache: long enough that a mail client opening the same message twice
  // doesn't re-resolve, short enough that a freshly generated signature takes
  // over quickly. Image proxies (Gmail) cache the RESOLVED bytes under this
  // URL, which is exactly what we want for mail already in an inbox.
  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
