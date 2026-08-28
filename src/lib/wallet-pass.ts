import crypto from "node:crypto";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isCardActive } from "@/lib/card-active";
import { resolveCardMeta, type ResolvedCardMeta } from "@/lib/resolve-card";

// ── Building one card's .pkpass ─────────────────────────────────────────────
//
// Extracted from the download route because there are now THREE callers that
// must produce byte-identical passes: the Add to Wallet download, the web
// service's "give me the current version of this pass", and the sweep that
// decides whether a pass has changed at all. Three copies of "what goes in a
// pass" would drift, and the failure mode is the worst kind — a device is told
// its pass changed, re-downloads, and gets something subtly different from
// what the website would have handed it.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

type CardRow = {
  username: string;
  name: string | null;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  label?: string | null;
};

export type PassInputs = { card: CardRow; meta: NonNullable<ResolvedCardMeta> | null };

/**
 * Everything a pass is built from, or null when the card must not have one.
 *
 * The kill-switches live here rather than at each call site: a deleted account,
 * an office card taken offline, or a card past its plan limit resolves to
 * nothing, and the web service then serves a 404 exactly like the download
 * route does. A pass already in a wallet keeps pointing at a card URL that
 * 404s too, which is the intended end state.
 */
export async function passInputs(username: string): Promise<PassInputs | null> {
  if (!(await isCardActive(username))) {
    // A pass serial is FROZEN on the device, but the card's slug can move
    // (the 2026-08-26 FirstLast-Company migration, and every auto-rename
    // since). Resolve the old slug to the card's current one and serve the
    // CURRENT card under the OLD serial: the serial (and the pass URL, which
    // 308-redirects) stay what the device expects, while the fields show the
    // live card. Without this, every installed pass went "gone" the moment
    // its card was renamed — no more updates, and the sweep counted it dead.
    const { findSlugAlias } = await import("@/lib/slug-alias");
    const current = await findSlugAlias(username);
    if (!current || current === username) return null;
    const inputs = await passInputs(current);
    if (!inputs) return null;
    return { ...inputs, card: { ...inputs.card, username } };
  }

  const admin = getAdminSupabase();
  // `label` is on cards and NOT on profiles — asking for it in the profiles
  // query would fail outright and 404 every legacy un-migrated card.
  const select = "username, name, title, company, phone, email, website";
  const { data: card } = await admin.from("cards").select(`${select}, label`).eq("username", username).maybeSingle();
  const src = card ?? (await admin.from("profiles").select(select).eq("username", username).maybeSingle()).data;
  if (!src) return null;

  // A meta failure degrades to the plain navy pass rather than no pass.
  let meta: NonNullable<ResolvedCardMeta> | null = null;
  try { meta = await resolveCardMeta(username); } catch { meta = null; }

  return { card: src as CardRow, meta };
}

/**
 * A fingerprint of what this pass CONTAINS.
 *
 * The web service compares this, not a timestamp, to decide whether a pass has
 * really changed. Timestamps move whenever a row is touched — a login, an
 * unrelated column, a backfill — and every one of those would push a
 * re-download to every device holding the pass. Hashing the inputs means a
 * device is only ever woken for a change it would actually see.
 *
 * Caveat worth knowing: this covers the URLs of the headshot and logo, not
 * their bytes. Replacing an image *at the same URL* is invisible here. Our
 * upload paths write a new path per upload, so this doesn't arise in practice.
 */
export function passContentHash(inputs: PassInputs): string {
  const { card, meta } = inputs;
  const material = JSON.stringify({
    card: {
      name: card.name, title: card.title, company: card.company,
      phone: card.phone, email: card.email, website: card.website, label: card.label ?? null,
    },
    meta: meta && {
      name: meta.name, title: meta.title, company: meta.company,
      photoUrl: meta.photoUrl, logoUrl: meta.logoUrl,
      accentColor: meta.accentColor, template: meta.template,
      style: meta.style, custom: meta.custom,
    },
  });
  return crypto.createHash("sha256").update(material).digest("hex");
}

/** The signed .pkpass for these inputs. */
export async function buildPass(inputs: PassInputs): Promise<Buffer> {
  return (await buildPassDetailed(inputs)).buf;
}

/**
 * Same, plus whether the pass came out DEGRADED: a photo/logo the card has
 * could not be fetched (or the styled strip failed entirely and the plain
 * pass was used). The download route uses this to skip fingerprinting, so
 * the next sweep re-delivers the real thing instead of treating the
 * initials version as final.
 */
export async function buildPassDetailed(inputs: PassInputs): Promise<{ buf: Buffer; degraded: boolean }> {
  const { card, meta } = inputs;
  const { buildPkpass } = await import("@/lib/wallet");

  let design;
  let degraded = false;
  try {
    if (meta) {
      const { buildWalletDesign } = await import("@/lib/wallet-strip");
      design = await buildWalletDesign(meta);
      degraded = design.degraded;
    }
  } catch (e) {
    console.error("[wallet] card-styled strip failed, using plain pass:", e);
    degraded = true;
  }

  const buf = await buildPkpass({
    username: card.username,
    name: card.name || "SwiftCard",
    title: card.title,
    company: card.company,
    phone: card.phone,
    email: card.email,
    website: card.website,
    label: card.label ?? null,
    cardUrl: `${APP_URL}/${card.username}?source=apple_wallet`,
  }, design);
  return { buf, degraded };
}
