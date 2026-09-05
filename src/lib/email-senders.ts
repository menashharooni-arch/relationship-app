// THE one place every outbound From address is decided.
//
// Before this file, one address — hello@swiftcard.me — sent everything: a user
// hand-sharing their card, a Stripe receipt, a marketing blast, and the
// watchdog's own alerts. Mailbox providers score a domain on aggregate
// behaviour, so a single "Report spam" on a campaign damaged the deliverability
// of the card shares the product exists to send. It also meant a reply to a
// receipt and a reply to a stranger's invite landed in the same queue.
//
// Five identities now, split by WHAT THE MESSAGE IS — never by who paid, and
// never by which file happens to send it:
//
//   connect@  a user, to another person.        Reply goes to THAT USER.
//   support@  the platform, to its own users.   Reply comes to us.
//   billing@  money. Nothing else.              Reply comes to us.
//   news@     bulk campaigns.                   Reply routed to support.
//   hello@    INBOUND ONLY. Never a From.
//
// All five are on swiftcard.me, which is already verified in Resend, so they
// inherit its SPF, DKIM and DMARC and need no DNS work. Reputation is scored
// per-domain, so this split does NOT isolate them from each other — what it
// buys is per-address filtering, clean reply routing, and the ability to move
// bulk to its own subdomain later without touching a single call site.

export type SenderKey = "connect" | "support" | "billing" | "news" | "inbox";

const DOMAIN = "swiftcard.me";

/** The brand name on every From. One name, so the inbox row always reads the same. */
export const BRAND = "SwiftCard";

type SenderDef = {
  address: string;
  /** Default display name. `connect` overrides this per-sender ("Dana via SwiftCard"). */
  name: string;
  /** Where a reply should land when the caller doesn't supply one. */
  defaultReplyTo: string | null;
  /** False for hello@ — it receives, it must never appear in a From header. */
  canSend: boolean;
};

// ── Are the aliases live yet? ────────────────────────────────────────────────
//
// connect@, support@, billing@ and news@ can SEND the moment the domain is
// verified — sending never requires the mailbox to exist. RECEIVING does.
//
// Until those aliases are actually provisioned in Google Workspace, pointing a
// receipt's Reply-To at billing@ would be STRICTLY WORSE than today: right now
// those emails carry no Reply-To at all, so replies fall back to the From —
// hello@, a real monitored mailbox — and reach a human. Sending them to an
// address that does not exist turns a customer's reply into a bounce.
//
// So the From splits immediately (that is the deliverability and organisation
// win) while replies keep going somewhere known-good. Flip this to true the
// moment the aliases exist and every reply path moves in one line.
//
// 2026-09-05: LIVE. connect@, support@, billing@ and news@ were created as
// aliases on hello@swiftcard.me in Google Workspace and verified end to end —
// a message to each was accepted and logged for the domain in Email Log Search.
// The domain has no catch-all and no default routing rule (both checked, both
// empty) and exactly one user, so those addresses resolve because the aliases
// exist and for no other reason. Every reply path below now lands on its own
// identity instead of falling back to the shared inbox.
export const ALIASES_LIVE = true;

const INBOX = `hello@${DOMAIN}`;

/** Where replies go for a platform identity: itself once live, hello@ until then. */
function replyHome(self: string): string {
  return ALIASES_LIVE ? self : INBOX;
}

export const SENDERS: Record<SenderKey, SenderDef> = {
  // A user sending to a person they met. The display name carries THEIR name
  // and the reply must reach them — replyToFor() takes their address as an
  // override. The default below only catches a card with no email on file,
  // which before this change fell through to hello@ and must keep doing so.
  connect: { address: `connect@${DOMAIN}`, name: BRAND, defaultReplyTo: replyHome(`connect@${DOMAIN}`), canSend: true },

  // Onboarding, account status, team invitations, time-sensitive notices.
  support: { address: `support@${DOMAIN}`, name: BRAND, defaultReplyTo: replyHome(`support@${DOMAIN}`), canSend: true },

  // Receipts, dunning, subscription state. Nothing else, ever — mixing product
  // mail into the billing identity is how billing mail stops being trusted.
  billing: { address: `billing@${DOMAIN}`, name: BRAND, defaultReplyTo: replyHome(`billing@${DOMAIN}`), canSend: true },

  // Campaigns and promos. Replies go to a human queue, not into the void.
  news: { address: `news@${DOMAIN}`, name: BRAND, defaultReplyTo: replyHome(`support@${DOMAIN}`), canSend: true },

  // The public front door and the internal alert destination. RECEIVE ONLY:
  // mail From hello@ To hello@ is the shape of a spoof, and every one of those
  // teaches the owner's own mailbox that hello@ arrives from outside.
  inbox: { address: INBOX, name: BRAND, defaultReplyTo: null, canSend: false },
};

/** Where humans write to us. Contact form, abuse reports, agent digests land here. */
export const INBOX_ADDRESS = SENDERS.inbox.address;

// A display name can be user-supplied (a card name), so strip anything that
// could break out of the header. Header injection via CR/LF is the real risk.
function safeName(name: string | null | undefined, fallback: string): string {
  return (name || "").replace(/[<>"\r\n]/g, "").trim() || fallback;
}

/**
 * The From header for a sender.
 *
 * `displayName` personalises it — used only by `connect`, where the recipient
 * must see the person who messaged them. "via SwiftCard" is appended because a
 * bare personal name on an address that is not theirs is display-name
 * spoofing, and Gmail scores it that way; it is the pattern Google documents
 * for services sending on a user's behalf.
 */
export function from(key: SenderKey, displayName?: string | null): string {
  const s = SENDERS[key];
  if (!s.canSend) {
    // Loud, not silent: routing a send to the inbox address is a bug, and the
    // failure mode if we let it through is mail that trains the owner's own
    // spam filter against their own domain.
    throw new Error(`email-senders: ${s.address} is receive-only and must never appear in a From header`);
  }
  if (!displayName) return `${s.name} <${s.address}>`;
  const name = safeName(displayName, s.name);
  const via = new RegExp(BRAND, "i").test(name) ? name : `${name} via ${BRAND}`;
  return `${via} <${s.address}>`;
}

/**
 * The Reply-To for a sender.
 *
 * `override` is the user's own address on `connect` mail — a reply to a card
 * share is a reply to that person, and must never reach us. Everywhere else
 * the sender's own default applies, so no user-facing email can have a
 * Reply-To that goes nowhere.
 */
export function replyToFor(key: SenderKey, override?: string | null): string | null {
  const clean = (override || "").trim();
  if (clean) return clean;
  return SENDERS[key].defaultReplyTo;
}

/**
 * Every address a reply can actually land on, given the CURRENT alias state.
 *
 * This is deliberately derived from ALIASES_LIVE rather than hand-listed: a
 * hand-written list would just assert the aspiration and the test would prove
 * only that the list contains itself. While the aliases are not provisioned
 * this is exactly one address — the mailbox we know is monitored.
 */
export const MUST_RECEIVE: string[] = ALIASES_LIVE
  ? [INBOX, SENDERS.connect.address, SENDERS.support.address, SENDERS.billing.address]
  : [INBOX];
