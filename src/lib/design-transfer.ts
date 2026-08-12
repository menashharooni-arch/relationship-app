// ── Design transfer: an uploaded card design, re-issued to the owner ────────
//
// The owner uploads a picture of a card design they like (their old printed
// card, a template screenshot, someone else's card). The image model rebuilds
// THAT design carrying THIS owner's details. This file owns the instruction —
// pure string-building, no fetch — so tests can pin what the model is asked
// without touching a provider.
//
// The contract with the caller (and the UI): the output is a PROPOSAL. Image
// models fumble small text often enough that nothing here may auto-publish;
// the owner approves a side-by-side preview or regenerates. "It cannot make
// any mistakes" is delivered by that gate, not by trusting the model.

export type TransferIdentity = {
  name: string;
  title?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  /** Whether reference images ride along in the same request, in this order. */
  hasHeadshot?: boolean;
  hasLogo?: boolean;
};

/** One line per fact the model may print — and an explicit "omit" list, because
 *  the single worst failure is the TEMPLATE's details surviving onto the card. */
export function transferPrompt(id: TransferIdentity): string {
  const facts: string[] = [`- Name: ${id.name}`];
  if (id.title?.trim()) facts.push(`- Job title: ${id.title.trim()}`);
  if (id.company?.trim()) facts.push(`- Company: ${id.company.trim()}`);
  if (id.phone?.trim()) facts.push(`- Phone: ${id.phone.trim()}`);
  if (id.email?.trim()) facts.push(`- Email: ${id.email.trim()}`);
  if (id.website?.trim()) facts.push(`- Website: ${id.website.trim()}`);
  if (id.address?.trim()) facts.push(`- Address: ${id.address.trim()}`);

  const refs: string[] = [];
  if (id.hasHeadshot) refs.push("The FIRST extra image is this person's headshot — put it wherever the design shows a person's photo, cropped the same way.");
  if (id.hasLogo) refs.push(`The ${id.hasHeadshot ? "SECOND" : "FIRST"} extra image is their company logo — put it wherever the design shows a logo.`);

  return [
    "The first image is a business card design. Recreate it EXACTLY — same layout,",
    "same fonts, same colours, same graphics, same alignment and spacing — but",
    "belonging to a different person. Replace every piece of personal information",
    "on it with the details below, each in the same position and style as the",
    "text it replaces:",
    "",
    ...facts,
    "",
    ...refs,
    "",
    "Rules:",
    "- Print ONLY the details listed above. Any name, number, email, address,",
    "  company or handle from the original that has no replacement listed must be",
    "  REMOVED, leaving the design's styling intact.",
    "- Do not add, move, resize or restyle anything. Do not add a QR code, logo",
    "  or decoration the original does not have.",
    "- Keep the exact canvas: same aspect ratio, no borders or margins added.",
    "- Spell every detail exactly as written above, character for character.",
    "Return only the edited image.",
  ].join("\n");
}

/** Everything the approval UI asks the owner to eyeball, in checklist order.
 *  Kept next to the prompt so the two never drift apart. */
export function transferChecklist(id: TransferIdentity): string[] {
  const items = ["Your name is spelled exactly right"];
  if (id.phone?.trim()) items.push("The phone number is yours, digit for digit");
  if (id.email?.trim()) items.push("The email is yours, character for character");
  if (id.company?.trim() || id.title?.trim()) items.push("Title and company read correctly");
  items.push("Nothing from the original card's owner is still visible");
  return items;
}
