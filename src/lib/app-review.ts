import { detectNativeApp } from "@/lib/platform";

// ── When to ask for an App Store rating ──────────────────────────────────────
//
// The prompt itself is Apple's (ios/App/App/AppReview.swift → AppStore.request-
// Review). iOS caps it at three showings per 365 days and may show nothing at
// all, so this file's only job is to make sure the ONE moment we spend is a
// good one — after the product has visibly worked for this person, never in the
// middle of something, and never on their first day.
//
// THE RULES, and why each exists:
//
//  1. Native app only. On the web the plugin does not exist; this no-ops.
//  2. Never before the 3rd day of use. A rating asked on day one measures
//     nothing and burns one of the three.
//  3. Only after MEANINGFUL_MOMENTS real wins — a card saved, a card viewed by
//     someone else, a contact captured. Opening the app is not a win.
//  4. Once per app version, ever. iOS throttles anyway; this stops us asking
//     the same person on every launch of the same build.
//  5. At least REASK_DAYS between attempts, in case the version changes often.
//  6. NEVER gated on sentiment. RateUsCard asks how you feel and routes unhappy
//     answers to a private box — correct for Trustpilot, and precisely what
//     Apple forbids for the App Store prompt. So the two are not connected:
//     this counts what someone DID, not whether they liked it.
//  7. Fire-and-forget. iOS never says whether the sheet appeared, so no UI may
//     wait on it and nothing may say "please rate us" beside it.

const MOMENTS_KEY = "sc_review_moments";   // comma-separated distinct moments
const ASKED_KEY = "sc_review_asked";      // "<version>|<iso date>"
const MEANINGFUL_MOMENTS = 3;
const MIN_DAYS_INSTALLED = 3;
const REASK_DAYS = 120;
const FIRST_SEEN_KEY = "sc_first_seen";

/** A real win worth counting. Deliberately a closed set. */
export type ReviewMoment =
  | "card_saved"        // they finished editing a card
  | "card_viewed"       // someone else opened their card
  | "contact_captured"  // a lead landed
  | "card_shared";      // they handed the link to someone

const read = (k: string): string | null => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const write = (k: string, v: string): void => {
  try { localStorage.setItem(k, v); } catch { /* private mode — just don't ask */ }
};

/** Days since we first saw this install, seeding the clock on first call. */
function daysInstalled(): number {
  const seen = read(FIRST_SEEN_KEY);
  if (!seen) { write(FIRST_SEEN_KEY, new Date().toISOString()); return 0; }
  const then = Date.parse(seen);
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** The build we are running, so we ask at most once per version. */
function appVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION || "web";
}

/**
 * Record a win and, if this is the right moment, ask iOS for the rating sheet.
 * Safe to call from anywhere, as often as you like: everything below is a
 * no-op unless every rule passes.
 */
export function noteReviewMoment(moment: ReviewMoment): void {
  if (typeof window === "undefined") return;
  if (!detectNativeApp()) return;

  // Count DISTINCT kinds of win, not repetitions of one. Saving the same card
  // three times in a row is one person fiddling with their title; a save plus a
  // share plus a captured contact is the product actually working.
  const seen = new Set((read(MOMENTS_KEY) ?? "").split(",").filter(Boolean));
  seen.add(moment);
  write(MOMENTS_KEY, [...seen].join(","));
  const count = seen.size;

  if (count < MEANINGFUL_MOMENTS) return;
  if (daysInstalled() < MIN_DAYS_INSTALLED) return;

  const asked = read(ASKED_KEY);
  if (asked) {
    const [version, when] = asked.split("|");
    if (version === appVersion()) return;                    // already asked on this build
    const days = (Date.now() - Date.parse(when || "")) / 86_400_000;
    if (Number.isFinite(days) && days < REASK_DAYS) return;  // too soon regardless
  }

  // Mark BEFORE requesting. If the plugin is missing or the call throws we
  // still must not retry on the next moment — a prompt that never appears is
  // indistinguishable from one that did, and asking in a loop is the failure
  // mode this whole file exists to avoid.
  write(ASKED_KEY, `${appVersion()}|${new Date().toISOString()}`);
  void requestNativeReview();
}

/** The bare call. Exported for the "Rate this app" row in Settings. */
export async function requestNativeReview(): Promise<void> {
  try {
    const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, { requestReview?: () => Promise<unknown> }> } }).Capacitor;
    await cap?.Plugins?.AppReview?.requestReview?.();
  } catch {
    /* Fails closed: an older build without the plugin simply never prompts. */
  }
}
