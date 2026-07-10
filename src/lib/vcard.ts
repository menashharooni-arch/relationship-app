// Shared vCard (RFC 6350 / vCard 3.0) builder.
//
// This de-duplicates the two vCard implementations that used to live inline in
// SaveContactButton (client "download my contact") and api/leads/vcard (server
// "download a captured lead"). Both now call buildVCard so escaping, field
// ordering, and the optional embedded PHOTO stay identical everywhere.
//
// The builder is PURE — it never fetches. Callers that want to embed a headshot
// fetch the image themselves (client: via the SSRF-guarded /api/img-proxy;
// server: fetched server-side) and hand the already-encoded bytes in as a
// VCardPhoto. A missing/failed image simply omits PHOTO — it never throws and
// never corrupts the card.

export type VCardPhone = { number: string; label?: string | null; showOnCard?: boolean };

export type VCardAddress = {
  street?: string | null;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export interface VCardPerson {
  name: string;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  /** Legacy single phone — used only when `phones` is empty. */
  phone?: string | null;
  phones?: VCardPhone[] | null;
  fax?: string | null;
  website?: string | null;
  address?: VCardAddress | null;
  linkedin?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
}

export interface VCardPhoto {
  /** Base64 payload — a bare base64 string OR a full `data:` URL (both accepted). */
  base64: string;
  /** Image mime type (e.g. "image/jpeg"). Inferred from a data: URL if omitted. */
  mime?: string | null;
}

// vCard escaping (RFC 6350): a ";", "," or "\" in a value would otherwise shift
// field boundaries and corrupt (or, for visitor-supplied values, inject into)
// the saved contact. Newlines are collapsed so they can't add fake fields.
export function escapeVCardValue(v?: string | null): string {
  return String(v ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/([,;\\])/g, "\\$1")
    .trim();
}

// Absolute URL for a bare domain / handle so URL/social lines are clickable.
export function normalizeVCardUrl(url?: string | null): string {
  const s = String(url ?? "").trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// Build the folded PHOTO line, or null if the payload is unusable. iOS/macOS
// import a base64-embedded photo reliably in vCard 3.0 form:
//   PHOTO;ENCODING=b;TYPE=JPEG:<base64>
// Long lines are folded at 75 octets with a leading space on continuations
// (RFC 2426 §2.6) so strict parsers still accept the card.
function photoLine(photo: VCardPhoto): string | null {
  let b64 = (photo.base64 || "").trim();
  if (!b64) return null;

  let mime = (photo.mime || "").toLowerCase();
  const dataMatch = b64.match(/^data:([^;,]+)?(?:;base64)?,([\s\S]*)$/i);
  if (dataMatch) {
    if (!mime && dataMatch[1]) mime = dataMatch[1].toLowerCase();
    b64 = dataMatch[2];
  }
  b64 = b64.replace(/\s+/g, "");
  // Guard: must look like base64 and carry real bytes.
  if (!b64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return null;

  const type = /png/.test(mime)
    ? "PNG"
    : /gif/.test(mime)
    ? "GIF"
    : /webp/.test(mime)
    ? "WEBP"
    : "JPEG";

  const full = `PHOTO;ENCODING=b;TYPE=${type}:${b64}`;
  const folded: string[] = [];
  for (let i = 0; i < full.length; i += 74) {
    folded.push((i === 0 ? "" : " ") + full.slice(i, i + 74));
  }
  return folded.join("\r\n");
}

// Assemble a complete vCard string. Empty/absent fields are simply omitted.
export function buildVCard(person: VCardPerson, photo?: VCardPhoto | null): string {
  const esc = escapeVCardValue;
  const name = (person.name || "").trim();
  const parts = name.split(" ");
  const first = parts[0] ?? "";
  const rest = parts.slice(1).join(" ");

  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(name)}`,
    `N:${esc(rest)};${esc(first)};;;`,
  ];

  if (person.title) lines.push(`TITLE:${esc(person.title)}`);
  if (person.company) lines.push(`ORG:${esc(person.company)}`);
  if (person.email) lines.push(`EMAIL;TYPE=WORK:${esc(person.email)}`);

  // All phones, typed (mobile → CELL, office → WORK); fall back to the legacy
  // single phone; fax last.
  const phones = (person.phones ?? []).filter((p) => p?.number?.trim());
  if (phones.length) {
    for (const p of phones) {
      const type = p.label === "office" ? "WORK,VOICE" : "CELL,VOICE";
      lines.push(`TEL;TYPE=${type}:${esc(p.number)}`);
    }
  } else if (person.phone) {
    lines.push(`TEL:${esc(person.phone)}`);
  }
  if (person.fax && person.fax.trim()) lines.push(`TEL;TYPE=FAX:${esc(person.fax)}`);

  if (person.website) lines.push(`URL:${esc(normalizeVCardUrl(person.website))}`);

  const addr = person.address;
  if (addr && (addr.street || addr.city || addr.state || addr.zip)) {
    const street = [addr.street, addr.unit ? `Unit ${addr.unit}` : ""].filter(Boolean).join(" ");
    lines.push(`ADR;TYPE=WORK:;;${esc(street)};${esc(addr.city)};${esc(addr.state)};${esc(addr.zip)};`);
  }

  if (person.linkedin) lines.push(`URL;type=LinkedIn:${esc(normalizeVCardUrl(person.linkedin))}`);
  if (person.instagram) lines.push(`X-SOCIALPROFILE;type=instagram:${esc(person.instagram.replace(/^@/, ""))}`);
  if (person.twitter) lines.push(`X-SOCIALPROFILE;type=twitter:${esc(person.twitter.replace(/^@/, ""))}`);
  if (person.tiktok) lines.push(`X-SOCIALPROFILE;type=tiktok:${esc(person.tiktok.replace(/^@/, ""))}`);

  // Embedded headshot — best-effort; a bad/missing image is silently skipped so
  // saving a contact never breaks over a photo.
  if (photo) {
    const pl = photoLine(photo);
    if (pl) lines.push(pl);
  }

  lines.push("END:VCARD");
  return lines.join("\r\n");
}
