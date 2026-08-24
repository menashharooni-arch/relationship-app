// ── Consent to send data to the AI provider ─────────────────────────────────
//
// App Review rejected 1.0.0 (3) under Guidelines 5.1.1(i) and 5.1.2(i):
//
//   "The app appears to share the user's personal data with a third-party AI
//    service but the app does not clearly explain what data is sent, identify
//    who the data is sent to, and ask the user's permission before sharing."
//
// The previous notice failed all three: it said "our AI provider" (nobody
// named), "contact details you provide" (nothing enumerated — and it never
// mentioned that the scanner uploads a photograph of somebody ELSE's business
// card), and its only button was "Got it", which is an acknowledgement rather
// than permission. Apple also notes that putting this in the privacy policy
// alone is not sufficient, so it has to be asked in the app.
//
// What is sent, honestly, per feature:
//   • Card scanner        — the photo you take of another person's card
//   • Follow-up drafts    — that contact's name, company, where you met, notes
//   • Design rebuild      — the photo of the card design you upload
//   • In-app assistant    — the message you type
//
// Consent is stored per ACCOUNT on profiles.customization, alongside the other
// underscore-prefixed flags (_deleted, _usage, _aiConsentAccepted).

export type AiConsent = "accepted" | "declined" | "unset";

/**
 * Read the stored decision.
 *
 * `_aiConsentAccepted: true` is the pre-rejection shape and deliberately does
 * NOT count as a decision. The notice that wrote it is the one App Review
 * ruled insufficient — no provider named, no data enumerated, and its only
 * button was "Got it", an acknowledgement rather than permission. Consent that
 * wasn't informed isn't consent, so those accounts are asked once more with
 * the real dialog (and the review demo account, which carries the legacy
 * flag, shows the ask to the reviewer instead of silently skipping it).
 * Everything new writes `_aiConsent`, which the new dialog is the only
 * author of.
 */
export function readAiConsent(customization: unknown): AiConsent {
  const c = (customization ?? {}) as Record<string, unknown>;
  if (c._aiConsent === "accepted" || c._aiConsent === "declined") return c._aiConsent;
  return "unset";
}

/**
 * Whether an AI request may proceed for this account — WEB semantics.
 *
 * "unset" passes here: the web has never shown a prompt (adding new visible
 * web UI is off-limits) and its users have not refused anything. What must be
 * honoured everywhere is an explicit NO — a declined account's data is not
 * sent from any platform. For requests from the iOS shell, use
 * aiConsentPermits with isShell=true instead: in the app, "hasn't answered
 * yet" must BLOCK.
 */
export function aiConsentAllows(customization: unknown): boolean {
  return readAiConsent(customization) !== "declined";
}

/**
 * The full permission rule, platform-aware. This is the sentence App Review
 * keeps writing back at us, as code:
 *
 *   "Obtain the user's permission BEFORE sending data."   (5.1.2(i))
 *
 * In the app that means consent is OPT-IN: only an explicit "accepted" lets
 * data leave. An account that has never answered ("unset") is blocked until
 * the dialog is answered. The earlier model — block only an explicit decline —
 * is what produced three straight 5.1.1 rejections: any path that reached an
 * AI feature before the dialog happened to render (the help bubble on a page
 * without the gate, the design scanner on /cards/new) shared data with the
 * provider having asked nothing.
 *
 * On the web "unset" still passes (no prompt has ever been shown there, and
 * nothing was refused); a decline made in the app is honoured everywhere.
 */
export function aiConsentPermits(consent: AiConsent, isShell: boolean): boolean {
  if (consent === "declined") return false;
  if (consent === "accepted") return true;
  return !isShell; // unset: web proceeds, the app must ask first
}

/**
 * The exact disclosure shown before anything is sent.
 *
 * Built from the live provider name (see aiProviderName) so swapping providers
 * cannot silently make this sentence false — which is the failure mode that
 * produced the rejection in the first place.
 */
export function aiConsentCopy(provider: string): {
  title: string;
  what: string[];
  who: string;
  control: string;
} {
  return {
    title: "Before you use AI features",
    what: [
      "Photos you take of a business card, when you scan one",
      "A contact's name, company, where you met and your notes, when AI writes a follow-up",
      "Messages you type to the in-app assistant",
    ],
    // Deliberately does NOT claim anything about model training. Whether the
    // provider trains on API input depends on the plan we are on, and a
    // privacy promise we cannot verify is a worse problem than the one this
    // notice exists to fix. State only what is ours to state.
    who: `This is sent to ${provider} to produce the result, and to no one else. SwiftCard never sells your data or your contacts' data.`,
    control: "You can say no and keep using everything else in SwiftCard. AI features simply stay off.",
  };
}
