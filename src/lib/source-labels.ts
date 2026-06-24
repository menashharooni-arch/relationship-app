export const SOURCE_LABELS: Record<string, string> = {
  instagram_bio: "Instagram bio",
  snapchat: "Snapchat",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  qr_code: "QR code scan",
  nfc_card: "NFC tap",
  direct_link: "Direct link",
  text_message: "Text message",
  email_signature: "Email signature",
  unknown: "Unknown",
};

export function getSourceLabel(source: string | null | undefined): string {
  if (!source) return "Unknown";
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}
