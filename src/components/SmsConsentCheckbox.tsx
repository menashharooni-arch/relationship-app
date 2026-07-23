// Share-form consent DISCLOSURE (no checkbox). Owner decision (Jul 2026):
// sharing your number + email IS the consent to be followed up with — so there
// is no separate opt-in box. Submitting the share form is the affirmative act;
// this line is the clear-and-conspicuous disclosure shown right next to that
// submit button, which is a recognized SMS-consent pattern (and, just as
// important, keeps the STOP/rate language the carrier/A2P rules require so the
// texts actually deliver instead of getting filtered).
//
// Every required element is here in one shared block so every capture surface
// is identical: sender identified, BOTH channels named, frequency/rates,
// STOP to opt out, and links to the SMS Terms + Privacy Policy. Keep it legible
// (never below 8px) and keep every element — don't cut further.
//
// The old `checked`/`onChange` props are accepted-and-ignored so the four
// capture forms didn't all have to change signatures at once; they pass
// sms_consent:true on submit now (consent via submission).
export default function SmsConsentCheckbox({
  recipientName,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** The person the visitor is sharing with — leads the copy when known. */
  recipientName?: string | null;
}) {
  const who = recipientName?.trim() || "the person you're sharing with";
  return (
    <p className="text-slate-500 text-[8px] leading-tight text-left">
      By sharing your info you agree to let {who} follow up by text and email. Msg frequency
      varies, msg &amp; data rates may apply, reply STOP to opt out.{" "}
      <a href="/sms-terms" target="_blank" rel="noopener" className="underline">SMS Terms</a>{" "}
      &amp;{" "}
      <a href="/privacy" target="_blank" rel="noopener" className="underline">Privacy</a>.
    </p>
  );
}
