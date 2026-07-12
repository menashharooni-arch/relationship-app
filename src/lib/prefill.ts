// One-shot prefill channel for the marketing "mini builders".
//
// The homepage lets a visitor sketch a card / SwiftLink / signature by entering
// just the few fields needed to preview it. When they hit "Make it live", we
// stash what they typed here and send them to the real builder (/cards/new),
// which reads this once on mount to autofill its fields — then clears it so a
// later visit to /cards/new starts blank. Everything the visitor entered is
// their own data, kept in their own browser; nothing is sent anywhere until
// they actually create the card.

export type PrefillSocials = Partial<
  Record<"linkedin" | "instagram" | "tiktok" | "facebook" | "twitter" | "snapchat" | "youtube", string>
>;

export type CardPrefill = {
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  bio?: string;
  website?: string;
  socials?: PrefillSocials;
  links?: { label: string; url: string }[];
  template?: string;
  accentColor?: string;
  step?: number; // which wizard step to open on (1 details · 2 links · 3 design)
};

const KEY = "swiftcard_prefill";

export function writePrefill(data: CardPrefill): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage blocked — the builder just starts blank, no harm */
  }
}

// Read once and remove, so the prefill is consumed exactly one time.
export function consumePrefill(): CardPrefill | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    return JSON.parse(raw) as CardPrefill;
  } catch {
    return null;
  }
}
