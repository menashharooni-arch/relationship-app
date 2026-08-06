// Share-form SMS consent CHECKBOX.
//
// HISTORY — do not "simplify" this back. This has now been a disclosure-only
// line twice ("submitting the form is the consent"), which is defensible under
// TCPA and was rejected for A2P 10DLC both times:
//
//   • 2026-07-29 — campaign CM1319bbf18064a7f2100b8b47716fef0b, error 30924,
//     raised directly against the disclosure-only design.
//   • 2026-08-04 — campaign CMc75ca0d204260393fa9c05e1b8f2e8c0, error 30896
//     on MESSAGE_FLOW. 8fa7f0c had reverted this component to the disclosure
//     line on 2026-08-05 while the submitted message_flow still described the
//     checkbox, so the reviewer opened the live card page, found copy that did
//     not match the submission, and rejected it.
//
// Restored 2026-08-06 on the owner's instruction, reversing 8fa7f0c. That
// commit's own header named this outcome: "If A2P review or an accessibility
// complaint comes back at this block, THIS is the commit to revert."
//
// Twilio Onboarding & Compliance (ticket #28654422, 2026-07-30) named two
// required elements, and a campaign cannot be approved without both:
//
//   1. TYPES OF MESSAGES — the opt-in must say WHAT the person will receive,
//      not just which channel. "texts & emails via SwiftCard" names a channel;
//      it is not a message type, and that is what error 30924 was flagging.
//   2. A REAL CHECKBOX — present, NOT pre-selected, and OPTIONAL, so a visitor
//      can submit the share form without opting in to SMS.
//
// "Optional" is functional, not cosmetic: the parent form must submit happily
// with this unchecked and post sms_consent:false. The leads route already
// distinguishes true / false / absent (sms-ok vs sms-paused vs neither), so an
// unchecked share is captured normally and simply never auto-texted.
//
// NEVER pre-check this, never default the parent state to true, and never make
// submission conditional on it — each of those re-breaks campaign approval and
// is a TCPA problem in its own right.
//
// SIZE IS LOAD-BEARING: 11px floor, set 2026-07-28 for A2P review. It was 8px,
// then briefly 10px/slate-400 (below WCAG AA at 2.56:1) under 1728fe8. Small,
// low-contrast type is what a reviewer reads as burying the disclosure. Never
// go below 11px, and keep the label at slate-500 or darker.
//
// Every element here is required: message types, frequency, msg & data rates,
// STOP, HELP, and links to SMS Terms + Privacy. Dropping "data" from "Msg &
// data rates may apply" breaks the recognized CTIA phrasing. This copy is
// quoted verbatim in /sms-consent, /sms-terms, /privacy and step 5b of
// STRIPE_TWILIO_SETUP.md — change one, change all five.
//
// `recipientName` is accepted and ignored: interpolating it here once rendered
// the raw card slug ("some-card-slug") with a missing space.
type Props = {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  recipientName?: string | null;
};

export default function SmsConsentCheckbox({ checked = false, onChange }: Props = {}) {
  return (
    <div className="text-left">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          className="mt-[2px] h-4 w-4 shrink-0 accent-brand cursor-pointer"
        />
        <span className="text-slate-500 text-[11px] leading-snug">
          <strong className="text-slate-600">Text me follow-ups (optional).</strong>{" "}
          I agree to receive follow-up text messages from this SwiftCard user about our
          conversation — their contact details, replies, and any follow-up messages they set up.
          Msg frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.
        </span>
      </label>
      <p className="text-slate-400 text-[11px] leading-snug mt-1.5">
        Optional — you can share your info without this and still hear back by email.{" "}
        <a href="/sms-terms" target="_blank" rel="noopener" className="underline">SMS Terms</a>
        {" · "}
        <a href="/privacy" target="_blank" rel="noopener" className="underline">Privacy</a>
      </p>
    </div>
  );
}
