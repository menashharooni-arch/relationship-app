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
      logoText: "SwiftCard",
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

  if (card.phone) pass.auxiliaryFields.push({ key: "phone", label: "PHONE", value: card.phone });
  if (card.email) pass.auxiliaryFields.push({ key: "email", label: "EMAIL", value: card.email });

  pass.backFields.push({ key: "open", label: "Your SwiftCard", value: card.cardUrl });
  if (card.website) pass.backFields.push({ key: "website", label: "Website", value: card.website });

  return pass.getAsBuffer();
}
