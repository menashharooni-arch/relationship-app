"use client";

// "Rate us" — an interactive star rating that routes by sentiment:
//   4–5 stars  → nudge to leave a PUBLIC review (Trustpilot) or a testimonial
//   1–3 stars  → open a PRIVATE feedback box that emails the team (/api/contact),
//                so unhappy users vent to us, not to a public rating page.
// The testimonial path also posts to /api/contact, tagged so the team can reuse
// it on the marketing testimonials page.

import { useState } from "react";

// Public review destinations. Trustpilot's evaluate URL works for any domain,
// so it never 404s. Add Product Hunt / G2 / Capterra URLs here once those
// profiles exist and they'll render automatically.
const REVIEW_LINKS: { label: string; href: string }[] = [
  { label: "Review on Trustpilot", href: "https://www.trustpilot.com/evaluate/swiftcard.me" },
];

function Star({ filled, onClick, onEnter }: { filled: boolean; onClick: () => void; onEnter: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onEnter}
      className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
      aria-label="rate"
    >
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill={filled ? "#f59e0b" : "none"} stroke={filled ? "#f59e0b" : "#4b5563"} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.36 4.78 5.28.77-3.82 3.72.9 5.26L11.48 15.5 6.76 18l.9-5.26L3.84 9.05l5.28-.77 2.36-4.78z" />
      </svg>
    </button>
  );
}

export default function RateUsCard({ name, email }: { name: string; email: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState<"feedback" | "testimonial" | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const shown = hover || rating;
  const happy = rating >= 4;

  async function submit() {
    if (!msg.trim()) return;
    setSending(true);
    const tag = mode === "testimonial" ? "Testimonial" : `Feedback ${rating}/5 ★`;
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || "SwiftCard user",
          email: email || "no-email@swiftcard.me",
          message: `[${tag}]\n\n${msg.trim()}`,
        }),
      });
      if (res.ok) setSent(true);
    } catch { /* ignore */ }
    setSending(false);
  }

  return (
    <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#f59e0b"><path d="M12 2l2.9 5.88 6.5.95-4.7 4.58 1.11 6.47L12 17.3 6.19 19.86 7.3 13.4 2.6 8.82l6.5-.95L12 2z" /></svg>
        </div>
        <div>
          <p className="text-gray-200 text-sm font-medium">Loving SwiftCard?</p>
          <p className="text-gray-500 text-xs leading-relaxed">Tap a star — 30 seconds and it genuinely helps us grow.</p>
        </div>
      </div>

      {!sent ? (
        <>
          <div className="flex items-center gap-0.5 mt-3 mb-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                filled={n <= shown}
                onEnter={() => setHover(n)}
                onClick={() => {
                  setRating(n);
                  setMode(n >= 4 ? null : "feedback");
                }}
              />
            ))}
          </div>

          {rating > 0 && happy && (
            <div className="mt-3">
              <p className="text-emerald-400 text-xs font-medium mb-3">Amazing — thank you! 🙌 Mind making it public?</p>
              <div className="space-y-2">
                {REVIEW_LINKS.map((r) => (
                  <a
                    key={r.href}
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-full transition-colors"
                  >
                    {r.label}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                  </a>
                ))}
                <button
                  type="button"
                  onClick={() => setMode(mode === "testimonial" ? null : "testimonial")}
                  className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs font-semibold py-2.5 rounded-full transition-colors"
                >
                  Write us a testimonial
                </button>
              </div>
            </div>
          )}

          {rating > 0 && !happy && (
            <p className="text-gray-400 text-xs mt-3 mb-2">Sorry it&apos;s not a 5 yet — tell us what would make it better and we&apos;ll read every word.</p>
          )}

          {(mode === "feedback" || mode === "testimonial") && (
            <div className="mt-3">
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={3}
                placeholder={mode === "testimonial" ? "What do you love about SwiftCard?" : "What's missing or frustrating?"}
                className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
              />
              <button
                type="button"
                onClick={submit}
                disabled={sending || !msg.trim()}
                className="w-full mt-2 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold py-2.5 transition-colors"
              >
                {sending ? "Sending…" : mode === "testimonial" ? "Send testimonial" : "Send feedback"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Thank you — we got it. 💙
        </div>
      )}
    </div>
  );
}
