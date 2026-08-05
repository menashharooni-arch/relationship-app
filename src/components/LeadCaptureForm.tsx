"use client";

import { useEffect, useState } from "react";
import { getVisitorId, getVisitorInfo, hasSharedWith, markSharedWith } from "@/lib/visitor";
import { triggerSignupNudge } from "@/lib/nudge";
import SmsConsentCheckbox from "@/components/SmsConsentCheckbox";

type Status = "idle" | "loading" | "done" | "error" | "limit";

export default function LeadCaptureForm({
  cardOwner,
  source = "direct_link",
}: {
  cardOwner: string;
  source?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [alreadyShared, setAlreadyShared] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  // SMS consent is by SUBMISSION (owner decision, Aug 2026): no checkbox, no
  // consent state — the disclosure sits below the share button and the post
  // below sends sms_consent:true. Restoring a real opt-in box means reverting
  // 8fa7f0c; the A2P trade-off is recorded in SmsConsentCheckbox.tsx.

  // If this visitor shared with this owner before, don't ask again — and
  // pre-fill their details in case they use another form on the page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read from localStorage
    setAlreadyShared(hasSharedWith(cardOwner));
    const v = getVisitorInfo();
    if (v) setForm((prev) => ({ ...prev, name: v.name, phone: v.phone, email: v.email }));
  }, [cardOwner]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setStatus("loading");

    let res: Response;
    try {
      res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          card_owner: cardOwner,
          source,
          visitor_id: getVisitorId(),
          sms_consent: true, // sharing = consent (disclosure above the button)
        }),
      });
    } catch {
      setStatus("error");
      return;
    }

    if (res.status === 402) {
      setStatus("limit");
    } else if (res.ok) {
      // Remember the share so nothing on this owner's pages asks again.
      markSharedWith(cardOwner, form);
      setStatus("done");
      // Same signup popup as every other "shared their info" moment on the card.
      setTimeout(() => triggerSignupNudge("share_info"), 900);
    } else {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="text-center py-3">
        <div className="w-12 h-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-slate-900 font-bold text-base">Info shared!</p>
      </div>
    );
  }

  // They already shared with this owner — never ask for their info twice.
  if (alreadyShared) {
    return (
      <div className="text-center py-2">
        <p className="text-slate-900 font-semibold text-sm">✓ You&apos;ve already shared your info</p>
        <p className="text-slate-500 text-xs mt-1">They have your details — no need to send them again.</p>
      </div>
    );
  }

  if (status === "limit") {
    return (
      <div className="text-center py-6">
        <p className="text-slate-900 font-semibold">Card at capacity</p>
        <p className="text-slate-500 text-sm mt-1">This person&apos;s card is full. Ask them to upgrade to SwiftCard Pro.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <input
        type="text"
        name="name"
        placeholder="Your name *"
        value={form.name}
        onChange={handleChange}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm"
      />
      <input
        type="tel"
        name="phone"
        placeholder="Your phone number *"
        value={form.phone}
        onChange={handleChange}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm"
      />
      <input
        type="email"
        name="email"
        placeholder="Your email (optional)"
        value={form.email}
        onChange={handleChange}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm"
      />
      <textarea
        name="message"
        placeholder="Quick message (optional)"
        value={form.message}
        onChange={handleChange}
        rows={2}
        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors shadow-sm resize-none"
      />
      {status === "error" && (
        <p className="text-red-400 text-xs text-center">Something went wrong. Try again.</p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-full transition-all text-sm active:scale-[0.98]"
        style={{ background: "#1D4ED8" }}
      >
        {status === "loading" ? "Sending…" : "Share My Info"}
      </button>
      {/* Submitting the form IS the consent for both channels (owner decision,
          Aug 2026), which is why this form posts sms_consent:true and there is
          no separate box — the disclosure below carries the required elements.
          Every email still carries an unsubscribe link. */}
      {/* "Every email includes an unsubscribe link." was removed here (owner
          decision, Aug 2026). It is not required at the point of capture —
          CAN-SPAM requires the unsubscribe MECHANISM in the commercial email
          itself, which every send already carries — so dropping the sentence
          from this form changes nothing about what we owe a recipient. The
          wrapper div went with it: with one child left there is nothing to
          group, so the disclosure is a direct child of the form again and picks
          up its space-y-3 exactly as it did before.
          Size/colour now live entirely in SmsConsentCheckbox — see the warning
          at the top of that file before changing either. */}
      <SmsConsentCheckbox recipientName={cardOwner} />
    </form>
  );
}
