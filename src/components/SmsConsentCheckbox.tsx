// Share-form consent DISCLOSURE (no checkbox). Sharing your number + email IS
// the consent to be followed up with, so there's no separate opt-in box —
// SUBMITTING the form is the affirmative act, and this one line is the
// clear-and-conspicuous disclosure right next to the Send button. Kept as small
// as it can be while still carrying the elements A2P/CTIA needs so the texts
// keep DELIVERING: both channels named, msg&data rates, STOP to opt out, and
// links to the SMS Terms + Privacy Policy. Deliberately NO sender name — the
// visitor is already on that person's card, and interpolating a name here
// rendered the raw slug ("some-card-slug") with a missing space. Keep ≥8px.
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
    <p className="text-slate-500 text-[8px] leading-tight text-left">
      By sharing you agree to follow-up texts &amp; emails. Msg &amp; data rates may apply. Reply
      STOP to opt out.{" "}
      <a href="/sms-terms" target="_blank" rel="noopener" className="underline">SMS Terms</a>
      {" · "}
      <a href="/privacy" target="_blank" rel="noopener" className="underline">Privacy</a>
    </p>
  );
}
