// ── "Did you mean you@gmail.com?" ───────────────────────────────────────────
//
// Email confirmation is OFF for SwiftCard (instant signup, owner decision), so
// nothing downstream ever catches a mistyped address: the account is created,
// works today, and can never be recovered once the session is gone — the reset
// email goes to gmial.com. This is the only net. It corrects towards the big
// consumer providers only; a company domain is never second-guessed.
//
// Pure module: no React, no window.

export const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "live.com",
  "me.com",
] as const;

/**
 * Real providers that sit within edit distance 2 of the list above. Someone
 * typing one of these meant it; "correcting" mail.com to aol.com would be the
 * exact harm this file exists to prevent.
 */
export const KNOWN_GOOD_DOMAINS: readonly string[] = [
  "mail.com", "ymail.com", "rocketmail.com", "msn.com", "gmx.com", "pm.me",
  "hotmail.co.uk", "yahoo.co.uk", "outlook.co.uk", "live.co.uk", "me.org",
  "mac.com", "yahoo.fr", "yahoo.de", "gmail.co.uk",
];

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * The corrected address when the domain looks like a slip of a common provider,
 * else null. The local part is returned exactly as typed (only the domain is
 * lowercased for comparison), so "Ann.Lee@GMIAL.com" → "Ann.Lee@gmail.com".
 */
export function suggestDomain(email: string): string | null {
  const trimmed = (email ?? "").trim();
  const at = trimmed.indexOf("@");
  if (at <= 0 || trimmed.indexOf("@", at + 1) !== -1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!domain.includes(".") || !local) return null;
  if ((COMMON_DOMAINS as readonly string[]).includes(domain) || KNOWN_GOOD_DOMAINS.includes(domain)) return null;

  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of COMMON_DOMAINS) {
    const d = levenshtein(domain, candidate);
    if (d < bestDistance) { bestDistance = d; best = candidate; }
  }
  if (!best) return null;
  // One slip is always a typo. Two slips only count against a domain long
  // enough that two edits can't turn one real short domain into another.
  if (bestDistance === 1 || (bestDistance === 2 && domain.length >= 7)) return `${local}@${best}`;
  return null;
}
