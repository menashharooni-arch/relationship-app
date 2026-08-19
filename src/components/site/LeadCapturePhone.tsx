"use client";

import { useState } from "react";
import CardScaler from "@/components/CardScaler";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import { SAMPLE_DATA, withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";
import ShareButton from "@/components/ShareButton";
import DemoSwiftLinks from "./DemoSwiftLinks";
import { cardPageTheme } from "@/lib/card-page-theme";

// The lead-capture page phone: the REAL card-open experience exactly as a
// visitor sees it when they open a SwiftCard link — the real card template plus
// the real card-page sections (Save contact, Share your info, Swift Links,
// Share this card), built from the same components the live card page uses,
// on the same ambient accent-washed background the live page paints.
// The Save-contact and Share-your-info buttons work for view (local state, no
// network); everything else is display-only. Nothing here ever counts as real
// traffic.

const CARD: CardData = { ...withoutSocials(SAMPLE_DATA), photoUrl: "/marketing/demo-girl.jpg" };
const FIRST = SAMPLE_DATA.name.split(" ")[0];
const DEMO_URL = "https://swiftcard.me/alexmorgan";

// The live page borrows the card's palette — same derivation, same wash.
const THEME = cardPageTheme(null, "photo-first");

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold text-slate-800">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <svg viewBox="0 0 18 12" className="w-4 h-3" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1" /><rect x="5" y="4" width="3" height="8" rx="1" /><rect x="10" y="1" width="3" height="11" rx="1" opacity="0.4" /></svg>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12 18a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM5 13a10 10 0 0114 0l-1.5 1.5a8 8 0 00-11 0zm-3-3a14 14 0 0120 0l-1.5 1.5a12 12 0 00-17 0z" /></svg>
        <svg viewBox="0 0 26 13" className="w-6 h-3.5" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="22" height="12" rx="3" /><rect x="2" y="2" width="17" height="9" rx="1.5" fill="currentColor" /><rect x="23.5" y="4" width="2" height="5" rx="1" fill="currentColor" /></svg>
      </div>
    </div>
  );
}

const Panel = "w-full rounded-2xl p-4 shadow-sm";
const panelStyle = { background: "#fff", border: "1px solid #E4DDD4" } as const;

function LinkExperience() {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);

  return (
    <div className="px-4 pt-2 pb-8" style={{ background: THEME.pageBackground, ["--sc-accent" as string]: THEME.accent, ["--sc-accent-text" as string]: THEME.accentText }}>
      <div className="mx-auto max-w-[300px] flex flex-col gap-4">
        {/* The real card template — contact links are display-only in the demo */}
        <div className="rounded-2xl overflow-hidden" style={{ pointerEvents: "none" }}>
          <CardScaler><PhotoFirst data={CARD} /></CardScaler>
        </div>

        {/* Save contact — plain bold heading, like the live page (the numbered
            badges were removed in the 2026-08-19 card-page redesign). */}
        <div className={Panel} style={panelStyle}>
          <p className="text-slate-900 font-bold text-[13px] tracking-tight">Save {FIRST}&apos;s contact</p>
          <p className="text-slate-500 text-[11px] mt-0.5 mb-2.5">One tap adds them to your phone contacts — no app needed.</p>
          <button
            onClick={() => setSaved(true)}
            className="w-full rounded-full py-2.5 text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 transition-colors"
            style={{ background: saved ? "#16a34a" : THEME.accent }}
          >
            {saved ? (
              <><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>Saved to Contacts</>
            ) : (
              <><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21v-8H5v8M5 3h11l3 3v3M9 3v4h6" strokeLinecap="round" strokeLinejoin="round" /></svg>Save {FIRST}&apos;s contact</>
            )}
          </button>
        </div>

        {/* Share your info back (the lead-capture handshake) */}
        <div className={Panel} style={panelStyle}>
          <p className="text-slate-900 font-bold text-[13px] tracking-tight mb-2">Share your info with {FIRST}</p>
          {shared ? (
            <div className="py-3 text-center">
              <div className="w-10 h-10 mx-auto mb-1.5 rounded-full bg-green-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <p className="text-slate-900 font-bold text-[13px]">Info shared!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {/* The real form's fields, in the real order: name and PHONE are
                  required, email is optional, and there is a message field.
                  The mock previously showed name → email → phone with nothing
                  marked required, which is not the form a visitor meets. */}
              {["Your name *", "Your phone number *", "Your email (optional)", "Quick message (optional)"].map((ph) => (
                <div key={ph} className="h-9 rounded-lg bg-white flex items-center px-3 text-[12px] text-slate-400" style={{ border: "1px solid #E4DDD4" }}>{ph}</div>
              ))}
              {/* The SMS consent checkbox, directly above the submit button —
                  the position and copy our A2P 10DLC campaign (COJQ2MB) is
                  registered on, and the affirmative opt-in that gates every
                  automated text. Leaving it out of the marketing mock hid the
                  single most load-bearing element of the lead-capture flow.
                  Shown UNTICKED, as it always renders: it is optional, the form
                  submits without it, and pre-checking it would break TCPA.
                  Copy is trimmed to what fits a 300px mock — the full
                  disclosure lives in SmsConsentCheckbox and on /sms-consent. */}
              <div className="mt-1 flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-[2px] w-[13px] h-[13px] rounded-[3px] shrink-0 bg-white"
                  style={{ border: "1.5px solid #C9BFB2" }}
                />
                <span className="text-[9.5px] leading-[1.35] text-slate-500">
                  <strong className="text-slate-600">Text me follow-ups (optional).</strong>{" "}
                  Msg frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out.
                </span>
              </div>
              <button
                onClick={() => setShared(true)}
                className="mt-1 w-full h-10 rounded-lg text-white text-[12.5px] font-bold flex items-center justify-center"
                style={{ background: THEME.accent, border: "1.5px solid #ffffff", boxShadow: `0 0 0 2px ${THEME.accent}, 0 0 0 5px ${THEME.accent}2E` }}
              >
                Share my info →
              </button>
            </div>
          )}
        </div>

        {/* Swift Links (the real card section, shared by every mockup) */}
        <div className={Panel} style={panelStyle}>
          <DemoSwiftLinks />
        </div>

        {/* Share this card — just the share button, like the live page (the
            "Show QR Code" control was removed from the card page: a sharer's
            tool sitting in a viewer's flow). */}
        <div className={Panel} style={panelStyle}>
          <ShareButton url={DEMO_URL} text={`Connect with ${FIRST} — save their contact instantly.`} label="Share this card" />
        </div>
      </div>
    </div>
  );
}

export default function LeadCapturePhone() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5 text-white/45 text-[12px] font-medium">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M12 19l-4-4M12 19l4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Exactly what they see when they open your card
      </div>
      <div className="rd-phone w-[300px]">
        {/* 650, not 600. The screen is a scrolling viewport over a ~1270px card
            page, so where it cuts is a choice — and it should cut on a boundary,
            not mid-control. Adding the message field and the SMS consent
            checkbox pushed the "Share my info" button's bottom to 619 and its
            panel's to 636, so a 600px screen sliced the button in half and read
            as a rendering bug. 650 lands just past the completed panel, which is
            the whole point of this page: the capture handshake, finished. */}
        <div className="rd-phone-screen h-[650px]" style={{ background: "#FAF7F2" }}>
          <div className="rd-notch" />
          <div className="absolute inset-0 overflow-y-auto rd-scrollbar-none">
            <StatusBar />
            <LinkExperience />
          </div>
          <div className="pointer-events-none absolute inset-0 z-10" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 26%)" }} />
        </div>
      </div>
    </div>
  );
}
