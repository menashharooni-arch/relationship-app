// The share-link preview image URL, and how to keep it hot.
//
// WHY THIS FILE EXISTS: the preview image is rendered on demand, and Vercel
// purges its edge cache on every deploy — we deploy several times a day, so a
// real share almost always hits a cold function (sharp + satori load, a storage
// download, a resize). Messengers give the image only a few seconds. iMessage
// and Mail (Apple's LinkPresentation) fall back to the LARGEST PICTURE ON THE
// PAGE when og:image does not arrive in time, which on a photo-first card is
// the owner's headshot — "it's just showing a picture of my face". The card was
// never wrong; it was late. So every path that hands the link to a messenger
// warms the exact URL the messenger is about to fetch, before it fetches it.

/** Fields that change what the preview looks like. Any change busts the URL. */
export type PreviewMeta = {
  name?: string | null; title?: string | null; company?: string | null;
  photoUrl?: string | null; logoUrl?: string | null; template?: string | null;
  accentColor?: string | null; phone?: string | null; email?: string | null;
  website?: string | null; address?: string | null;
};

// Short, stable content hash (djb2). Messengers cache the image BY URL, so a
// static URL would keep showing the old card forever after an edit.
export function previewVersion(p: PreviewMeta): string {
  const s = JSON.stringify([
    p.name, p.title, p.company, p.photoUrl, p.logoUrl, p.template,
    p.accentColor, p.phone, p.email, p.website, p.address,
  ]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** The exact og:image URL the card page advertises. */
export function shareImageUrl(appUrl: string, username: string, p: PreviewMeta): string {
  return `${appUrl}/${username.toLowerCase()}/opengraph-image?v=${previewVersion(p)}`;
}

/** Pull og:image out of a card page's HTML — null if the tag is missing. */
export function ogImageFromHtml(html: string): string | null {
  const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/);
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

/**
 * Warm the page and its preview image for a card link, exactly as a messenger
 * will fetch them. Fire-and-forget: never throws, never blocks the share sheet.
 * Fetches the public page for its og:image so the warmed URL is always the
 * versioned one the messenger sees — no second copy of the version logic on
 * the client to drift.
 *
 * Runs in the browser only. A plain fetch runs no page script, so the owner
 * warming their own link does not register as a card view.
 */
function onThisPage(cardUrl: string): boolean {
  try {
    const u = new URL(cardUrl, window.location.href);
    return u.origin === window.location.origin
      && u.pathname.replace(/\/$/, "").toLowerCase() === window.location.pathname.replace(/\/$/, "").toLowerCase();
  } catch {
    return false;
  }
}

export function warmSharePreview(cardUrl: string): void {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  const clean = cardUrl.split("#")[0];
  void (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      // On the card page itself (a visitor forwarding it) the tag is already
      // in the DOM — don't re-download the page just to read it.
      let img = onThisPage(clean)
        ? document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null
        : null;
      if (!img) {
        const res = await fetch(clean, { credentials: "omit", signal: ctrl.signal });
        img = ogImageFromHtml(await res.text());
      }
      if (img) await fetch(img, { credentials: "omit", signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
    } catch { /* best effort — the messenger will fetch it anyway */ }
  })();
}

/**
 * Server-side warm, for links WE send (the share-a-card text/email). Resolved
 * before the message goes out so the recipient's messenger finds a hot cache.
 * Bounded: a slow render must not delay the send by more than this.
 */
export async function warmSharePreviewServer(imageUrl: string, timeoutMs = 6000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(imageUrl, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}
