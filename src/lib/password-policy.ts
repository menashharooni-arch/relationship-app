// ── The one password rule ───────────────────────────────────────────────────
//
// Every place a password is SET (create account, reset, change) reads this file,
// and the Supabase project's password_min_length is kept equal to MIN_LENGTH by
// scripts/supabase-auth-policy.mjs. Sign-in never runs it: an account made under
// the old 6-character rule keeps signing in until it next sets a password.
//
// Deliberately no complexity rules (owner decision 2026-09-24): "must contain a
// number and a symbol" mostly produces Password1! on a phone keyboard and costs
// signups. Length is the rule; the meter is advice, not a gate.
//
// Pure module — no React, no window — so it is unit-testable and safe to import
// from a server component.

export const MIN_LENGTH = 8;

export const CONFIRM_MISMATCH = "Passwords don't match.";

/**
 * Passwords nobody should be allowed to keep. Everything here is ≥ MIN_LENGTH on
 * purpose — anything shorter is already refused by the length rule, so listing
 * "123456" would only be dead weight. Lowercase; compared lowercase.
 */
export const COMMON_PASSWORDS: readonly string[] = [
  "password", "password1", "password123", "passw0rd", "p@ssw0rd",
  "12345678", "123456789", "1234567890", "11111111", "00000000", "87654321",
  "qwerty123", "qwertyuiop", "1q2w3e4r", "asdfghjkl",
  "iloveyou", "sunshine", "princess", "football", "baseball", "superman",
  "welcome1", "letmein1", "admin123", "abc12345", "trustno1",
  "computer", "whatever", "monkey123", "dragon123", "michael1", "jennifer",
  "swiftcard", "swiftcard1", "swiftcard123",
];

export type PasswordScore = 0 | 1 | 2 | 3;
export type PasswordLabel = "Too short" | "Weak" | "OK" | "Strong";

export type PasswordAssessment = {
  /** false = must not be accepted; `reason` says why in the user's words. */
  ok: boolean;
  /** 0 when blocked; 1–3 is advice only and never blocks. */
  score: PasswordScore;
  label: PasswordLabel;
  reason: string | null;
};

/** "Ann.Lee@Example.com" → "ann.lee". Empty when there is no address. */
export function emailLocalPart(email: string | null | undefined): string {
  const at = (email ?? "").trim().toLowerCase();
  const i = at.indexOf("@");
  return i > 0 ? at.slice(0, i) : "";
}

export function assessPassword(password: string, email?: string | null): PasswordAssessment {
  const pw = password ?? "";
  if (pw.length < MIN_LENGTH) {
    return { ok: false, score: 0, label: "Too short", reason: `Use at least ${MIN_LENGTH} characters.` };
  }
  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.includes(lower)) {
    return { ok: false, score: 0, label: "Weak", reason: "That password is too common. Pick something harder to guess." };
  }
  // The whole local part ("ann.lee"), and its first token ("ann" only when it
  // is 4+ chars — "ann" alone would refuse every password with those letters).
  const local = emailLocalPart(email);
  const first = local.split(/[._-]/)[0] ?? "";
  const fragments = [local, first].filter((s) => s.length >= 4);
  if (fragments.some((s) => lower.includes(s))) {
    return { ok: false, score: 0, label: "Weak", reason: "Your password can't contain your email address." };
  }

  const classes =
    (/[a-z]/.test(pw) ? 1 : 0) + (/[A-Z]/.test(pw) ? 1 : 0) + (/\d/.test(pw) ? 1 : 0) + (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
  const len = pw.length;
  if (len >= 14 || (len >= 12 && classes >= 3)) return { ok: true, score: 3, label: "Strong", reason: null };
  if (len >= 10 || (len >= 8 && classes >= 3)) return { ok: true, score: 2, label: "OK", reason: null };
  return { ok: true, score: 1, label: "Weak", reason: null };
}
