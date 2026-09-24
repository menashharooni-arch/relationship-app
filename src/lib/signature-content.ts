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

import type { CardData, CustomLayout } from "@/components/card-templates/types";
import { hasBlocks, normalizeCustomLayout } from "./custom-layout";

/**
 * Every social handle a card carries: the top-level columns plus the ones that
 * live only in customization. Edited on the Socials tab.
 */
export const SOCIAL_KEYS = ["instagram", "linkedin", "twitter", "tiktok", "snapchat", "youtube", "facebook"] as const;

/**
 * Does the card IMAGE draw any social handle? The owner's rule (2026-09-24):
 * "Update your signature" is for changes to the card or its design — never for
 * socials or social design. Standard templates never draw socials (the card
 * page and the signature capture both render them through withoutSocials), so
 * a socials edit there can't change the signature. The one exception is a
 * Custom card whose layout has a socials block turned on: those handles ARE
 * on the card, so editing them does change the signature. Mirrors CustomCard's
 * own renderer choice (face image → blocks → free elements).
 */
export function cardShowsSocials(template: unknown, customization: unknown): boolean {
  if (template !== "custom") return false;
  const raw = (customization as { customLayout?: unknown } | null | undefined)?.customLayout;
  const norm = normalizeCustomLayout(raw);
  if (norm.faceImage) return false;
  const isSocial = (t?: string) => t === "socials" || t === "social";
  if (hasBlocks(raw as CustomLayout)) return (norm.blocks ?? []).some((b) => b.on && isSocial(b.type));
  // No free elements = CustomCard falls back to its default layout, which has a socials row.
  if (!norm.elements?.length) return true;
  return norm.elements.some((e) => isSocial(e.type));
}

/** Customization keys that live on the /links page, not on the card image. */
const PAGE_ONLY_KEYS = [
  "links", "bio", "about",
  "linkLook", "linkBgColor", "linkTextColor", "linkFontFamily",
  "linkIconShape", "linkIconFill",
  // The Swift Links page background. Nothing about it can reach the card
  // image, so a card whose only change is a new background photo must not
  // count as a card that needs its signature re-rendered.
  "linkBgMedia", "linkBgMediaType", "linkBgDim", "linkGlass",
  // The "View SwiftCard" button at the bottom of the Swift Links page.
  "hideCardLink",
] as const;

/**
 * Is this customization key about the Swift Links PAGE rather than the card?
 * The listed keys, plus EVERY `link…` style key (linkHero*, linkButton*,
 * linkAccentColor, … — camelCase, so the "linkedin" social never matches):
 * the list above missed the newer ones, and changing only a Swift Links hero
 * or button style told the owner to re-copy their signature. One rule, shared
 * with lib/card-changed so the capture and the reminder can't disagree.
 */
export function isLinksPageOnlyKey(k: string): boolean {
  return (PAGE_ONLY_KEYS as readonly string[]).includes(k) || /^link[A-Z]/.test(k);
}

/** Short stable hash (djb2) — small, deterministic, good enough for change detection. */
export function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * The card data with links-page-only keys stripped: what the signature can see.
 * With a template, socials are stripped too unless that card draws them
 * (cardShowsSocials) — a Socials-tab edit must not look like a card change.
 */
export function cardImageData(d: CardData, template?: string): CardData {
  const c = { ...(d.customization ?? {}) } as Record<string, unknown>;
  for (const k of Object.keys(c)) if (isLinksPageOnlyKey(k)) delete c[k];
  if (template === undefined || cardShowsSocials(template, d.customization)) return { ...d, customization: c } as CardData;
  const out = { ...d, customization: c } as Record<string, unknown>;
  for (const k of SOCIAL_KEYS) { delete out[k]; delete c[k]; }
  return out as CardData;
}

/**
 * Content signature for a card's Swift Signature capture. Changes exactly when
 * something the signature image RENDERS changes (card info, card design,
 * template, the URL it links to) — never for links-page or socials edits the
 * card doesn't draw. The version prefix forces a global re-capture when the
 * capture pipeline itself is fixed.
 */
export function signatureContentSig(cardData: CardData, template: string, cardUrl: string): string {
  return "v13|" + hashStr(JSON.stringify(cardImageData(cardData, template)) + "|" + template + "|" + cardUrl);
}

/**
 * The v12 hash (socials still counted). Only for carrying a browser's stored
 * "last copied" / "last captured" marks over to v13: if the stored mark equals
 * the v12 hash of the card as it is NOW, nothing has changed since — rewriting
 * it as v13 keeps the format change from telling every user to re-copy.
 */
export function legacySignatureContentSigV12(cardData: CardData, template: string, cardUrl: string): string {
  return "v12|" + hashStr(JSON.stringify(cardImageData(cardData)) + "|" + template + "|" + cardUrl);
}
