import { PKPass } from "passkit-generator";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export type WalletCard = {
  username: string;
  name: string;
  title?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  cardUrl: string; // full https URL the pass barcode/link points at
};

// Pass images are committed under /public/wallet and served by the CDN — fetched
// here rather than read from disk (files in /public aren't on the serverless FS).
async function loadAsset(name: string): Promise<Buffer> {
  const res = await fetch(`${APP_URL}/wallet/${name}`);
  if (!res.ok) throw new Error(`wallet asset ${name}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Build a SIGNED .pkpass for a card. Only called when hasWalletConfig() is true,
// so the Apple certificate env vars are guaranteed present.
export async function buildPkpass(card: WalletCard): Promise<Buffer> {
  const [icon, icon2, icon3, logo, logo2] = await Promise.all([
    loadAsset("icon.png"),
    loadAsset("icon@2x.png"),
    loadAsset("icon@3x.png"),
    loadAsset("logo.png"),
    loadAsset("logo@2x.png"),
  ]);

  const pass = new PKPass(
    {
      "icon.png": icon,
      "icon@2x.png": icon2,
      "icon@3x.png": icon3,
      "logo.png": logo,
      "logo@2x.png": logo2,
    },
    {
      wwdr: process.env.APPLE_WWDR_PEM as string,
      signerCert: process.env.APPLE_PASS_CERT_PEM as string,
      signerKey: process.env.APPLE_PASS_KEY_PEM as string,
      signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSWORD || undefined,
    },
    {
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID as string,
      teamIdentifier: process.env.APPLE_TEAM_ID as string,
      serialNumber: card.username,
      organizationName: "SwiftCard",
      description: `${card.name} — SwiftCard`,
      // NO logoText. logo.png is a 160x50 WORDMARK that already reads
      // "SwiftCard", so setting logoText printed the brand twice in the pass
      // header — the wordmark image with a second "SwiftCard" rendered next to
      // it. If the logo asset is ever swapped for a bare glyph, put logoText
      // back.
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(13, 27, 62)",
      labelColor: "rgb(147, 197, 253)",
    }
  );

  pass.type = "generic";
  // QR of the card URL — scanning the pass opens the live card.
  pass.setBarcodes({ message: card.cardUrl, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1" });
  pass.primaryFields.push({ key: "name", label: "", value: card.name });

  if (card.title) pass.secondaryFields.push({ key: "title", label: "TITLE", value: card.title });
  if (card.company) pass.secondaryFields.push({ key: "company", label: "COMPANY", value: card.company });

  if (card.phone) pass.auxiliaryFields.push({ key: "phone", label: "PHONE", value: prettyPhone(card.phone) });
  if (card.email) pass.auxiliaryFields.push({ key: "email", label: "EMAIL", value: card.email });

  // The back of the pass (the "..." button) is the only place with room for
  // detail, and it was nearly empty — just a bare URL. Someone who opens it
  // should find everything the card holds and understand what the pass is FOR,
  // since a Wallet pass with no explanation reads like a coupon that failed.
  pass.backFields.push({
    key: "about",
    label: "About this pass",
    value:
      "Your SwiftCard, ready to share. Show the QR code on the front and the other person's camera opens your live card — no app needed on their side. Edit your card at any time and this pass keeps pointing at the current version.",
  });
  pass.backFields.push({ key: "open", label: "Your card", value: card.cardUrl });
  if (card.phone) pass.backFields.push({ key: "phone-back", label: "Phone", value: prettyPhone(card.phone) });
  if (card.email) pass.backFields.push({ key: "email-back", label: "Email", value: card.email });
  if (card.website) pass.backFields.push({ key: "website", label: "Website", value: card.website });

  return pass.getAsBuffer();
}

/**
 * Human-readable US phone formatting for the pass.
 *
 * Deliberately a local copy rather than an import of formatPhone() from
 * card-templates/shared.tsx: that module also exports React components, and
 * this file runs inside a serverless route where pulling a component module in
 * for four lines of string work is the wrong trade. Anything that is not a
 * recognisable US number is returned untouched, so international numbers are
 * never mangled.
 */
function prettyPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}
