// SMS consent for visitor-facing share-info forms (TCPA/CTIA + Twilio A2P).
// No "use client" directive on purpose: every consumer is already a client
// component (the capture forms), and marking this file a client ENTRY would
// trip the serializable-props rule on the onChange callback.
// Requirements this implements, in one shared block so every capture surface
// is identical: affirmative opt-in (unchecked by default), separate from the
// general share disclosure, optional (submitting without checking still works —
// the lead is then created with the sms-paused tag so automated texts skip
// them), sender identified, frequency/rates/STOP/HELP stated, and direct links
// to the SMS Terms and Privacy Policy. Copy is trimmed to the legal essentials
// to save space — keep it legible (never below 8px) and keep every required
// element above, don't cut further.
export default function SmsConsentCheckbox({
  checked,
  onChange,
  recipientName,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The person the visitor is sharing with — leads the copy when known
   *  ("allow Alex to text you") instead of the generic fallback. */
  recipientName?: string | null;
}) {
  const who = recipientName?.trim() || "the person you're sharing with";
  return (
    <label className="flex items-start gap-2 text-left cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 accent-blue-600"
      />
      <span className="text-slate-500 text-[8px] leading-tight">
        Check this box to have {who} reach out to you by text via SwiftCard. Msg frequency varies,
        msg &amp; data rates may apply, reply STOP/HELP. Not required to share.{" "}
        <a href="/sms-terms" target="_blank" rel="noopener" className="underline">SMS Terms</a>{" "}
        &amp;{" "}
        <a href="/privacy" target="_blank" rel="noopener" className="underline">Privacy</a>.
      </span>
    </label>
  );
}
