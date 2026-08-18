// ── What the Swift Signature image actually depends on ───────────────────────
//
// The signature is a pixel-exact capture of the CARD template render. The
// card's customization object also carries the Swift LINKS page's content and
// styling (bio, link buttons, the Looks and their fine-tuning) — none of which
// appears on the card image. Hashing the whole object meant every links-page
// edit re-captured the signature AND raised the "you've changed your card
// design, re-copy your signature" prompt for a change the signature could not
// show. The owner's rule (2026-08-18): that prompt appears ONLY when card
// design or card info changed.

import type { CardData } from "@/components/card-templates/types";

/** Customization keys that live on the /links page, not on the card image. */
const PAGE_ONLY_KEYS = [
  "links", "bio", "about",
  "linkLook", "linkBgColor", "linkTextColor", "linkFontFamily",
  "linkIconShape", "linkIconFill",
] as const;

/** Short stable hash (djb2) — small, deterministic, good enough for change detection. */
export function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** The card data with links-page-only keys stripped: what the signature can see. */
export function cardImageData(d: CardData): CardData {
  const c = { ...(d.customization ?? {}) } as Record<string, unknown>;
  for (const k of PAGE_ONLY_KEYS) delete c[k];
  return { ...d, customization: c } as CardData;
}

/**
 * Content signature for a card's Swift Signature capture. Changes exactly when
 * something the signature image RENDERS changes (card info, card design,
 * template, the URL it links to) — never for links-page edits. The version
 * prefix forces a global re-capture when the capture pipeline itself is fixed.
 */
export function signatureContentSig(cardData: CardData, template: string, cardUrl: string): string {
  return "v12|" + hashStr(JSON.stringify(cardImageData(cardData)) + "|" + template + "|" + cardUrl);
}
