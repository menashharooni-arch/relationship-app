import { randomInt } from "node:crypto";
import type { getAdminSupabase } from "@/lib/supabase-admin";
import { resolveOwnerId } from "@/lib/self-traffic";

// ── Per-contact card links ───────────────────────────────────────────────────
//
// Every card link SwiftCard sends TO a known contact — a follow-up text or
// email, a share-card, "Copy personal link" — carries `?ct=<token>`. When that
// person opens it, the browser they opened it in is bound to them
// (contact_devices, bound_via 'link'), so their NEXT visit from that browser
// is recognised even though they never filled in the form on it. It is the
// only way a contact added by hand or by scanning a business card can ever be
// recognised, and it is how a contact on a second phone or a cleared browser
// gets recognised again. docs/plans/warm-lead-alerts.md §2.1.
//
// THE THREE RULES THAT KEEP IT HONEST
//
// 1. The server never credits the GET. A link opened by an email security
//    scanner (Outlook SafeLinks, Proofpoint, Mimecast), a messenger preview or
//    a crawler does nothing, because binding happens only when the card page's
//    tracker POSTs the token AFTER the human gate (2.5s visible, no webdriver)
//    — and the server refuses it from datacenter IPs, where scanners live.
// 2. The token is stripped from the address bar the moment the page reads it
//    (CardEventTracker), so copying the URL never passes it on.
// 3. A forwarded link can bind at most MAX_DEVICES_PER_LINK browsers, and
//    every browser after the first is announced as "your link to X was opened
//    on another device", never as X (owner decision D3).
//
// The token is opaque: 10 random base62 characters, no lead id, no name.
// Never throws; any failure falls back to the plain card URL.

type Admin = ReturnType<typeof getAdminSupabase>;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

/** The query parameter. Pinned by tests: it must never be renamed to one of
 *  the names Safari's Link Tracking Protection strips (fbclid, gclid, …). */
export const CONTACT_LINK_PARAM = "ct";

export const MAX_DEVICES_PER_LINK = 3;

export type ContactLinkChannel = "sms" | "email" | "share_card" | "manual_copy" | "scanner";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LEN = 10;

export function newContactToken(): string {
  let t = "";
  for (let i = 0; i < TOKEN_LEN; i++) t += ALPHABET[randomInt(ALPHABET.length)];
  return t;
}

export function isContactToken(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9]{10}$/.test(v);
}

/** `base` with the token appended, keeping any query it already has. */
export function withContactToken(base: string, token: string): string {
  return `${base}${base.includes("?") ? "&" : "?"}${CONTACT_LINK_PARAM}=${token}`;
}

/**
 * The card URL to send this lead: tracked when possible, the plain card link
 * otherwise (table not migrated, lead gone, owner unresolvable). `base` lets a
 * caller keep its own flags, e.g. share-card's `?shared=1`.
 */
export async function contactCardUrl(
  admin: Admin,
  opts: { leadId: string | null | undefined; cardSlug: string; channel: ContactLinkChannel; base?: string },
): Promise<string> {
  const plain = opts.base ?? `${APP_URL}/${opts.cardSlug}`;
  if (!opts.leadId || !opts.cardSlug) return plain;
  try {
    const ownerId = await resolveOwnerId(admin, opts.cardSlug);
    if (!ownerId) return plain;
    // Two attempts: a collision in a 62^10 space is a curiosity, not a plan.
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = newContactToken();
      const { error } = await admin.from("contact_links").insert({
        token,
        lead_id: opts.leadId,
        owner_id: ownerId,
        card_slug: opts.cardSlug,
        channel: opts.channel,
      });
      if (!error) return withContactToken(plain, token);
      if (error.code !== "23505") return plain;
    }
    return plain;
  } catch {
    return plain;
  }
}

export type LinkBindResult =
  | { status: "invalid" }
  | { status: "capped"; leadId: string }
  | { status: "already"; leadId: string; linkId: string }
  /** firstDevice: this is the first browser this link has bound. Every later
   *  one is "opened on another device", never the contact by name (D3). */
  | { status: "bound"; leadId: string; linkId: string; firstDevice: boolean };

/**
 * A human opened a tracked link in this browser: bind the browser to the
 * contact. Called by /api/card-events only after the human gate, the owner
 * exclusion and the datacenter check. `ownerId` is the owner of the card being
 * viewed — a token only ever binds on its own owner's cards.
 */
export async function bindViaLink(
  admin: Admin,
  opts: { token: string; ownerId: string; visitorId: string },
): Promise<LinkBindResult> {
  const { token, ownerId, visitorId } = opts;
  if (!isContactToken(token) || !ownerId || !visitorId) return { status: "invalid" };
  try {
    const { data: link } = await admin
      .from("contact_links")
      .select("id, lead_id, owner_id, open_count, first_opened_at, devices_bound, revoked_at")
      .eq("token", token)
      .maybeSingle();
    if (!link || link.owner_id !== ownerId || link.revoked_at) return { status: "invalid" };
    const leadId = link.lead_id as string;
    const linkId = link.id as string;
    const now = new Date().toISOString();

    await admin
      .from("contact_links")
      .update({ open_count: ((link.open_count as number) ?? 0) + 1, first_opened_at: link.first_opened_at ?? now })
      .eq("id", linkId);

    const { data: existing } = await admin
      .from("contact_devices")
      .select("id")
      .eq("lead_id", leadId)
      .eq("visitor_id", visitorId)
      .maybeSingle();
    if (existing) {
      // Already this contact's browser. A "wrong person" mark stands — the
      // owner said so, and a link click is weaker evidence than that.
      return { status: "already", leadId, linkId };
    }

    const bound = (link.devices_bound as number) ?? 0;
    if (bound >= MAX_DEVICES_PER_LINK) return { status: "capped", leadId };

    const { error } = await admin.from("contact_devices").insert({
      lead_id: leadId,
      owner_id: ownerId,
      visitor_id: visitorId,
      bound_via: "link",
      link_id: linkId,
    });
    if (error) return error.code === "23505" ? { status: "already", leadId, linkId } : { status: "invalid" };
    await admin.from("contact_links").update({ devices_bound: bound + 1 }).eq("id", linkId);
    return { status: "bound", leadId, linkId, firstDevice: bound === 0 };
  } catch {
    return { status: "invalid" };
  }
}

/** Stop every link sent to these leads from binding anything (unsubscribe). */
export async function revokeContactLinks(admin: Admin, leadIds: string[]): Promise<void> {
  if (!leadIds.length) return;
  try {
    await admin
      .from("contact_links")
      .update({ revoked_at: new Date().toISOString() })
      .in("lead_id", leadIds)
      .is("revoked_at", null);
  } catch {
    /* best effort */
  }
}
