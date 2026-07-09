"use client";

import { useState, useEffect } from "react";
import { triggerSignupNudge } from "@/lib/nudge";
import { hasSharedWith, markSharedWith } from "@/lib/visitor";

export type SocialLinkData = {
  label: string;
  href: string;
  sub?: string;
  color: string;
  textColor?: string;
};

function PlatformIcon({ label }: { label: string }) {
  switch (label) {
    case "LinkedIn":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case "Instagram":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case "X / Twitter":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "Snapchat":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
          <path d="M12.065 2C7.965 2 5.044 5.004 5.044 9.251v.307l-.001.111c-.046.97-.5 1.842-1.259 2.39a.43.43 0 00-.125.566c.108.192.33.286.548.24.556-.12 1.099-.308 1.617-.559a.142.142 0 01.147.007c.035.024.058.063.058.104 0 .043-.026.082-.065.103-.695.369-1.118 1.09-1.118 1.87 0 .168.019.335.057.5.198.867.915 1.542 1.838 1.717.282.053.573.08.866.08.303 0 .604-.028.895-.083.163-.031.325.054.393.207.716 1.613 2.26 2.682 4.011 2.862.173.017.345.026.52.026.176 0 .348-.009.521-.026 1.75-.18 3.295-1.249 4.011-2.862.068-.153.23-.238.393-.207.291.055.592.083.895.083.293 0 .584-.027.866-.08.923-.175 1.64-.85 1.838-1.717.038-.165.057-.332.057-.5 0-.78-.423-1.501-1.118-1.87a.117.117 0 01-.065-.103c0-.041.023-.08.058-.104a.143.143 0 01.147-.007c.518.251 1.061.44 1.617.559.218.046.44-.048.548-.24a.43.43 0 00-.125-.566c-.759-.548-1.213-1.42-1.259-2.39l-.001-.111v-.307C18.956 5.004 16.035 2 11.935 2h.13z" />
        </svg>
      );
    case "TikTok":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.95a8.27 8.27 0 004.84 1.56V7.07a4.85 4.85 0 01-1.07-.38z" />
        </svg>
      );
    case "Facebook":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "YouTube":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253M3 12a8.959 8.959 0 00.284 2.253" />
        </svg>
      );
  }
}

export default function SocialLinkIntercept({
  links,
  cardOwner,
  ownerFirstName,
}: {
  links: SocialLinkData[];
  cardOwner: string;
  ownerFirstName: string;
}) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string>("");
  const [alreadyShared, setAlreadyShared] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    // Reflect shared-state on mount, AND update live when the visitor shares via
    // any surface on the page (Save Contact, "Share your info", the connect form)
    // — after they've shared once, these links open without asking again.
    setAlreadyShared(hasSharedWith(cardOwner));
    const onShared = (e: Event) => {
      const owner = (e as CustomEvent).detail?.owner;
      if (!owner || owner === cardOwner) setAlreadyShared(true);
    };
    window.addEventListener("sc:shared", onShared as EventListener);
    return () => window.removeEventListener("sc:shared", onShared as EventListener);
  }, [cardOwner]);

  function handleClick(link: SocialLinkData, e: React.MouseEvent) {
    // Already shared (state OR a live re-check) → let the link open, no intercept.
    if (alreadyShared || hasSharedWith(cardOwner)) { setAlreadyShared(true); return; }
    e.preventDefault();
    setPendingHref(link.href);
    setPendingLabel(link.label);
    setStatus("idle");
    setForm({ name: "", phone: "", email: "" });
  }

  function skip() {
    if (pendingHref) window.open(pendingHref, "_blank", "noopener,noreferrer");
    setPendingHref(null);
    triggerSignupNudge("link_button");
  }

  // Just dismiss the popup without visiting the link.
  function close() {
    setPendingHref(null);
    triggerSignupNudge("link_button");
  }

  async function shareAndVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setStatus("loading");

    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        card_owner: cardOwner,
        source: `social_intercept_${pendingLabel.toLowerCase().replace(/\s+/g, "_")}`,
      }),
    });

    // Record the share the shared way (stores their info for pre-fill + broadcasts
    // so every other surface stops asking).
    markSharedWith(cardOwner, form);

    setAlreadyShared(true);
    setStatus("done");

    setTimeout(() => {
      if (pendingHref) window.open(pendingHref, "_blank", "noopener,noreferrer");
      setPendingHref(null);
      // They just shared their info off someone's card — invite them to make
      // their own (the host shows it once per session, never to logged-in users).
      triggerSignupNudge("share_info");
    }, 800);
  }

  const arrowIcon = (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 ml-auto opacity-50 shrink-0">
      <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
    </svg>
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        {links.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target={alreadyShared ? "_blank" : undefined}
            rel="noopener noreferrer"
            onClick={(e) => handleClick(s, e)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm hover:opacity-90 active:scale-[0.98]"
            style={{
              background: s.color + "12",
              color: s.textColor ?? s.color,
              border: `1px solid ${s.color}22`,
            }}
          >
            <PlatformIcon label={s.label} />
            <span className="flex flex-col leading-tight min-w-0 flex-1">
              <span>{s.label}</span>
              {s.sub && <span className="text-[11px] font-normal opacity-70 truncate">{s.sub}</span>}
            </span>
            {arrowIcon}
          </a>
        ))}
      </div>

      {pendingHref && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl p-6 animate-slide-up"
            style={{ background: "#FAF7F2", borderTop: "1px solid #E4DDD4" }}
          >
            {status === "done" ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-slate-900 font-bold text-base">Info shared! Opening {pendingLabel}…</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-slate-900 font-bold text-base leading-snug">
                      Let {ownerFirstName} follow you back
                    </p>
                    <p className="text-slate-500 text-sm mt-1">
                      Drop your info so {ownerFirstName} can connect with you on {pendingLabel}.
                    </p>
                  </div>
                  <button
                    onClick={close}
                    className="text-slate-400 hover:text-slate-600 transition-colors text-2xl leading-none shrink-0 ml-3"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={shareAndVisit} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Your name *"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                  />
                  <input
                    type="tel"
                    placeholder="Your phone *"
                    required
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                  />
                  <input
                    type="email"
                    placeholder="Your email (optional)"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full font-bold py-3 rounded-full text-white text-sm transition-all disabled:opacity-50"
                    style={{ background: "#1D4ED8" }}
                  >
                    {status === "loading" ? "Saving…" : `Share & visit ${pendingLabel} →`}
                  </button>
                  <button
                    type="button"
                    onClick={skip}
                    className="w-full text-slate-400 text-sm py-1.5 hover:text-slate-600 transition-colors"
                  >
                    Skip, just visit {pendingLabel}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </>
  );
}
