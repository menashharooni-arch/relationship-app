// SMS consent for visitor-facing share-info forms (TCPA/CTIA + Twilio A2P).
// No "use client" directive on purpose: every consumer is already a client
// component (the capture forms), and marking this file a client ENTRY would
// trip the serializable-props rule on the onChange callback.
// Requirements this implements, in one shared block so every capture surface
// is identical: affirmative opt-in (unchecked by default), separate from the
// general share disclosure, optional (submitting without checking still works —
// the lead is then created with the sms-paused tag so automated texts skip
// them), sender identified, frequency/rates/STOP/HELP stated, and direct links
// to the SMS Terms and Privacy Policy. Keep the copy legible — never below 8px.
export default function SmsConsentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-left cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 accent-blue-600"
      />
      <span className="text-slate-600 text-[8px] leading-snug">
        By checking this box, you agree to receive text messages from SwiftCard at the number
        provided — follow-up and reply messages from the person you&apos;re sharing your info with.
        Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP
        for help. Consent is not a condition of sharing your info. See our{" "}
        <a href="/sms-terms" target="_blank" rel="noopener" className="underline">SMS Terms</a> and{" "}
        <a href="/privacy" target="_blank" rel="noopener" className="underline">Privacy Policy</a>.
      </span>
    </label>
  );
}
