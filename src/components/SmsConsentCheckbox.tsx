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
// SIZE IS LOAD-BEARING: 12px, set 2026-07-28 for A2P campaign review. It was
// 8px, which is not "clear and conspicuous" under TCPA and reads to a campaign
// reviewer as burying the disclosure. Never shrink it below 12px.
// `/sms-consent` quotes this copy verbatim — change one, change both.
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
    <p className="text-slate-500 text-[12px] leading-snug text-left">
      By sharing your info you agree to receive follow-up texts &amp; emails via SwiftCard. Msg
      frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.{" "}
      <a href="/sms-terms" target="_blank" rel="noopener" className="underline">SMS Terms</a>
      {" · "}
      <a href="/privacy" target="_blank" rel="noopener" className="underline">Privacy</a>
    </p>
  );
}
