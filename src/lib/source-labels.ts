// ── CONTACT sources — how a contact reached this user's card ────────────────
export const SOURCE_LABELS: Record<string, string> = {
  instagram_bio: "Instagram bio",
  snapchat: "Snapchat",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  qr_code: "QR code scan",
  nfc_card: "NFC tap",
  direct_link: "Card link",       // opened the card's plain URL (sent by text/DM/etc.)
  text_message: "Text message",
  email_signature: "Email signature",
  manual: "Added by hand",        // the user typed the contact in themselves
  imported: "CSV import",
  scanner: "Card scanner",
  unknown: "Not tracked",
};

export function getSourceLabel(source: string | null | undefined): string {
  if (!source) return "Not tracked";
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

// ── SIGNUP sources — how a new ACCOUNT found SwiftCard (admin analytics) ─────
// Written so the admin instantly knows what each row means without a legend.
export const SIGNUP_SOURCE_LABELS: Record<string, string> = {
  direct:       "Organic — came to the site on their own",
  referral:     "Referral link (friend's /r/ code)",
  preview:      "Test It Live demo",
  save_contact: "Saved someone's contact, then signed up",
  share_info:   "Shared their info on a card, then signed up",
  vcard:        "Downloaded a vCard, then signed up",
  link_button:  "Tapped a Swift Links button",
  badge:        "'Powered by SwiftCard' badge",
  follow_up:    "Link in a follow-up email/text",
};

export function getSignupSourceLabel(source: string | null | undefined): string {
  if (!source) return SIGNUP_SOURCE_LABELS.direct;
  return SIGNUP_SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}
