import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey(): Buffer {
  const secret = process.env.OAUTH_SECRET;
  if (!secret) throw new Error("OAUTH_SECRET env var is not set");
  return Buffer.from(secret, "hex");
}

// AES-256-GCM (authenticated) for all NEW writes. The previous format was
// AES-256-CBC with no MAC — malleable and integrity-free. Existing stored
// tokens still decrypt via the legacy branch below and silently re-encrypt to
// GCM the next time they're saved. Formats:
//   GCM (current): "v2:" + iv(12B hex) + ":" + authTag(16B hex) + ":" + ciphertext hex
//   CBC (legacy):  iv(16B hex) + ":" + ciphertext hex
export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(data: string): string {
  if (data.startsWith("v2:")) {
    const [, ivHex, tagHex, encHex] = data.split(":");
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
  }
  // Legacy CBC rows written before the GCM migration.
  const [ivHex, encHex] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
