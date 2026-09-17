// ── What do I actually type in the Instagram box? ───────────────────────────
//
// Owner report 2026-09-15: "the way that they're told to put their social links
// in is very confusing. For example, LinkedIn: do they just type their name in,
// or do they have to type out linkedin.com/in/their name?"
//
// The cause was the placeholders disagreeing with each other. LinkedIn said
// "linkedin.com/in/you" and Facebook said "facebook.com/you" (type a URL) while
// Instagram, TikTok, X and Snapchat said "@username" (type a handle) — so the
// box itself gave a different answer per row and none of them said which was
// required. `socialUrl` has always accepted all of it, but nobody could tell.
//
// ONE answer now, every platform: type your username. This module is the single
// place that says so, so the wizard and the card editor cannot drift again.
//
// Storage is deliberately unchanged — `normalizeSocial` still decides what we
// keep (a URL-ish string for LinkedIn/Facebook/YouTube, "@handle" for the
// rest), and a pasted full profile URL still works exactly as before. This is
// what the person is TOLD, not what we save.

export type SocialInputKey =
  | "linkedin"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "twitter"
  | "snapchat"
  | "youtube";

export type SocialInputSpec = {
  key: SocialInputKey;
  /** The field label. */
  label: string;
  /** What goes in the box — a username, never a URL. */
  placeholder: string;
  /** The address we build from it. Shown so the promise is visible up front. */
  stem: string;
  /** A real-looking username for this platform, used in the hint. */
  example: string;
};

// Order matches the card's own social order (see buildConnectLinks).
export const SOCIAL_INPUTS: SocialInputSpec[] = [
  { key: "linkedin",  label: "LinkedIn",    placeholder: "yourname",    stem: "linkedin.com/in/",  example: "alexmorgan" },
  { key: "instagram", label: "Instagram",   placeholder: "yourname",    stem: "instagram.com/",    example: "alexmorgan" },
  { key: "tiktok",    label: "TikTok",      placeholder: "yourname",    stem: "tiktok.com/@",      example: "alexmorgan" },
  { key: "facebook",  label: "Facebook",    placeholder: "yourname",    stem: "facebook.com/",     example: "alexmorgan" },
  { key: "twitter",   label: "X (Twitter)", placeholder: "yourname",    stem: "x.com/",            example: "alexmorgan" },
  { key: "snapchat",  label: "Snapchat",    placeholder: "yourname",    stem: "snapchat.com/add/", example: "alexmorgan" },
  { key: "youtube",   label: "YouTube",     placeholder: "yourchannel", stem: "youtube.com/@",     example: "alexmorgan" },
];

/**
 * The hint under an EMPTY field. Deliberately one short line that answers the
 * question directly and then shows the address it becomes, so there is nothing
 * left to guess:
 *
 *   Just your username — becomes instagram.com/alexmorgan
 *
 * Kept as text (not a prefix glued inside the input) on purpose: a stem like
 * "snapchat.com/add/" eats ~100px, which on a 320px phone leaves a box too
 * narrow to read what you typed. Text wraps; a prefix clips.
 */
export function socialHint(spec: SocialInputSpec): string {
  return `Just your username — becomes ${spec.stem}${spec.example}`;
}

/** Lookup by key, for call sites that already iterate their own order. */
export function socialInput(key: string): SocialInputSpec | undefined {
  return SOCIAL_INPUTS.find((s) => s.key === key);
}
