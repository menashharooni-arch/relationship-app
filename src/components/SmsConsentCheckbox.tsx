// Share-form consent DISCLOSURE (no checkbox). Sharing your number + email IS
// the consent to be followed up with, so there's no separate opt-in box —
// SUBMITTING the form is the affirmative act, and this one line is the
// clear-and-conspicuous disclosure right next to the Send button. Because
// submission IS the consent, this line is the ONLY thing standing between us
// and an unconsented text, so it carries every element A2P/CTIA requires:
// both channels named, message frequency, msg&data rates, STOP to opt out,
// HELP for help, and links to the SMS Terms + Privacy Policy. Deliberately NO
// sender name — the visitor is already on that person's card, and interpolating
// a name here rendered the raw slug ("some-card-slug") with a missing space.
//
// ⚠️ SIZE AND CONTRAST ARE BELOW THE ADVISED FLOORS — OWNER DECISION, Aug 2026.
// 10px / text-slate-400 / leading-tight. This was asked for twice, the second
// time after being shown the history and the numbers below, so it is recorded
// here rather than argued again. If A2P review or an accessibility complaint
// comes back at this block, THIS is the commit to revert.
//   • Size was 11px, set 2026-07-28 for A2P campaign review, itself raised from
//     8px. There is no statutory px minimum — the standard is "clear and
//     conspicuous" — but Twilio rejected campaign
//     CM1319bbf18064a7f2100b8b47716fef0b with error 30924 over this
//     disclosure-only design, and small type is what a reviewer reads as
//     burying it. 10px is a step back toward the 8px that was already judged
//     too small; do not go further without expecting that outcome.
//   • Colour was text-slate-500 = 4.76:1 on the white share form, just above
//     the 4.5:1 WCAG AA floor for text this size. text-slate-400 is 2.56:1 and
//     is BELOW AA — legible on a good screen, marginal on a phone in sunlight,
//     and an ADA/"clear and conspicuous" exposure if it is ever challenged.
// The COPY is untouched and still carries every CTIA element; only size and
// weight moved. The tests below pin these exact values so the next change is a
// deliberate one too, not a drift further down.
//
// The copy is already trimmed to the shortest form that keeps all six required
// elements. Do not shorten further: dropping "data" from "Msg & data rates may
// apply" breaks the recognized CTIA phrasing, and dropping the sender, the
// frequency, STOP, HELP, or either link fails campaign review outright.
// Quoted verbatim in /sms-consent, /sms-terms, /privacy, and step 5b of
// STRIPE_TWILIO_SETUP.md — change one, change all five.
//
// `recipientName`/`checked`/`onChange` are accepted-and-ignored for back-compat
// with the four capture forms (they pass sms_consent:true on submit).
type Props = {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  recipientName?: string | null;
};
export default function SmsConsentCheckbox(_props: Props = {}) {
  void _props;
  return (
    <p className="text-slate-400 text-[10px] leading-tight text-left">
      By sharing, you agree to texts &amp; emails via SwiftCard. Msg frequency varies. Msg &amp; data
      rates may apply. Reply STOP to opt out, HELP for help.{" "}
      <a href="/sms-terms" target="_blank" rel="noopener" className="underline">SMS Terms</a>
      {" · "}
      <a href="/privacy" target="_blank" rel="noopener" className="underline">Privacy</a>
    </p>
  );
}
