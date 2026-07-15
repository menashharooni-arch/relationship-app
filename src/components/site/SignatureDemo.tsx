"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import CardScaler from "@/components/CardScaler";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import { withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";
import SaveContactButton from "@/components/SaveContactButton";
import SocialLinkIntercept from "@/components/SocialLinkIntercept";
import ShareButton from "@/components/ShareButton";
import QRCodeModal from "@/components/QRCodeModal";
import { buildConnectLinks } from "@/lib/social-url";

// Email Signature showcase: a wide, realistic email whose signature is the REAL
// SwiftCard — the PhotoFirst template rendered exactly as we ship it, with the
// person's photo. Clicking the signature pops up that same SwiftCard exactly as
// a recipient sees it: the identical card plus the real card-page boxes
// (Save contact, Share your info, Swift Links, Share this card) built from the
// same components the live /card page uses. Display-only here (no downloads,
// posts, or nav) — just an accurate preview.

// Same demo identity as SAMPLE_DATA (card-templates/types.tsx) and every other
// marketing demo (SwiftLinksPhone, TeamsDashboard, DashboardDemo) — one person,
// one company, everywhere on the site.
const IDENTITY = {
  name: "Alex Morgan",
  title: "Founder & CEO",
  company: "Morgan & Co.",
  phone: "(555) 123-4567",
  email: "alex@morganandco.com",
  website: "www.morganandco.com",
  linkedin: "linkedin.com/in/alexmorgan",
  instagram: "@morganandco",
  tiktok: "@morganandco",
  twitter: "@alexmorgan",
};
const FIRST = "Alex";
const CARD_URL = "https://swiftcard.me/card/alexmorgan";

const CARD_DATA: CardData = withoutSocials({
  name: IDENTITY.name,
  title: IDENTITY.title,
  company: IDENTITY.company,
  phone: IDENTITY.phone,
  email: IDENTITY.email,
  website: IDENTITY.website,
  initials: "AM",
  photoUrl: "/marketing/demo-girl.jpg",
  logoUrl: null,
  cardUrl: "swiftcard.me/card/alexmorgan",
});

const PERSON = {
  name: IDENTITY.name, title: IDENTITY.title, company: IDENTITY.company,
  email: IDENTITY.email, phone: IDENTITY.phone, website: IDENTITY.website,
  linkedin: IDENTITY.linkedin, instagram: IDENTITY.instagram, twitter: IDENTITY.twitter, tiktok: IDENTITY.tiktok,
  photoUrl: "/marketing/demo-girl.jpg",
};

const CONNECT_LINKS = buildConnectLinks({
  website: IDENTITY.website, linkedin: IDENTITY.linkedin,
  instagram: IDENTITY.instagram, tiktok: IDENTITY.tiktok, twitter: IDENTITY.twitter,
});

function SectionNumber({ n }: { n: number }) {
  return <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{ background: "#1D4ED8" }}>{n}</span>;
}
const PANEL = "w-full rounded-2xl p-5 shadow-sm";
const panelStyle = { background: "#fff", border: "1px solid #E4DDD4" } as const;
// The boxes are a faithful preview — disable interaction so the marketing page
// never triggers a vCard download, a lead POST, or a stacked full-screen modal.
const showOnly = { pointerEvents: "none" as const };

// The SwiftCard exactly as a recipient gets it — the same card and the same
// card-page boxes, built from the live components.
function SwiftCardPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto" style={{ background: "rgba(4,7,15,0.72)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="min-h-full flex items-start justify-center py-8 px-4">
        <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col items-center gap-5 rounded-3xl px-4 py-6" style={{ background: "#FAF7F2" }}>
            {/* The SwiftCard — identical PhotoFirst card as the signature */}
            <div className="w-full" style={showOnly}>
              <CardScaler><PhotoFirst data={CARD_DATA} /></CardScaler>
            </div>

            {/* Save contact */}
            <div className={PANEL} style={panelStyle}>
              <div className="flex items-center gap-3 mb-1"><SectionNumber n={1} /><p className="text-slate-900 font-semibold text-sm">Save {FIRST}&apos;s contact</p></div>
              <p className="text-slate-400 text-xs mb-4 ml-9">One tap adds them to your phone contacts — no app needed.</p>
              <div style={showOnly}>
                <SaveContactButton person={PERSON} username="alexmorgan" source="signature_demo" cardOwner="alexmorgan" ownerFirstName={FIRST} suppressTracking />
              </div>
            </div>

            {/* Share your info */}
            <div className={PANEL} style={panelStyle}>
              <div className="flex items-center gap-3 mb-1"><SectionNumber n={2} /><p className="text-slate-900 font-semibold text-sm">Share your info with {FIRST}</p></div>
              <p className="text-slate-400 text-xs mb-4 ml-9">They&apos;ll get your details and can follow up directly.</p>
              <div style={showOnly}>
                {/* Blank form — a faithful copy of the real LeadCaptureForm, empty. */}
                <div className="w-full space-y-3">
                  <input type="text" placeholder="Your name *" readOnly className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none shadow-sm" />
                  <input type="tel" placeholder="Your phone number *" readOnly className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none shadow-sm" />
                  <input type="email" placeholder="Your email (optional)" readOnly className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none shadow-sm" />
                  <textarea placeholder="Quick message (optional)" rows={2} readOnly className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none shadow-sm resize-none" />
                  <button type="button" className="w-full text-white font-semibold py-3 px-6 rounded-full text-sm" style={{ background: "#1D4ED8" }}>Share My Info</button>
                  <p className="text-slate-600 text-[8px] text-center leading-snug">By sharing your info you agree to receive follow-up messages by email or text. Reply STOP to a text anytime to opt out.</p>
                </div>
              </div>
            </div>

            {/* Swift Links */}
            <div className={PANEL} style={panelStyle}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0"><SectionNumber n={3} /><p className="text-slate-900 font-semibold text-sm">Swift Links</p></div>
                <span className="shrink-0 text-[11px] font-medium text-slate-400">Go to Swift Links →</span>
              </div>
              <div style={showOnly}>
                <SocialLinkIntercept links={CONNECT_LINKS} cardOwner="alexmorgan" ownerFirstName={FIRST} />
              </div>
            </div>

            {/* Share this card */}
            <div className={PANEL} style={panelStyle}>
              <div className="flex items-center gap-3 mb-4"><SectionNumber n={4} /><p className="text-slate-900 font-semibold text-sm">Share this card</p></div>
              <div style={showOnly}>
                <ShareButton url={CARD_URL} text={`Connect with ${FIRST} — save their contact instantly.`} label="Share this card" />
                <QRCodeModal url={CARD_URL} firstName={FIRST} />
              </div>
              <span className="block text-center text-slate-400 text-[11px] mt-3">Create your card · swiftcard.me</span>
            </div>

            {/* Powered by badge */}
            <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <svg viewBox="0 0 100 100" className="w-3 h-3"><polygon points="57,15 38,52 50,52 43,85 62,48 50,48" fill="currentColor" /></svg>
              Powered by SwiftCard.me
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignatureDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {/* Works everywhere */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 mb-5" data-reveal="fade">
        <span className="text-slate-500 text-[15px] font-medium">Works on all platforms —</span>
        {["Gmail", "Outlook", "Yahoo", "Hotmail", "Apple Mail"].map((p) => (
          <span key={p} className="rd-pill rd-pill-l text-[13px]">{p}</span>
        ))}
        <span className="text-slate-500 text-[15px] font-medium">all of it.</span>
      </div>

      {/* Click hint — on top of the email box */}
      <p className="text-center text-[15px] font-semibold mb-4 flex items-center justify-center gap-1.5" style={{ color: "#2563EB" }} data-reveal="fade">
        Click the signature and see what happens
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M12 19l-4-4M12 19l4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </p>

      {/* Wide email mockup */}
      <div className="rd-card-l overflow-hidden max-w-3xl mx-auto" data-reveal="scale">
        <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-100 bg-slate-50">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[12px] text-slate-400 font-medium">New Message</span>
        </div>
        <div className="p-6 sm:p-8 text-slate-700">
          <div className="text-[13px] space-y-1.5 pb-3 border-b border-slate-100">
            <p><span className="text-slate-400">To:</span> sarah@acme.com</p>
            <p><span className="text-slate-400">Subject:</span> Great connecting today</p>
          </div>
          <div className="pt-5 text-[14.5px] leading-relaxed space-y-3">
            <p>Hi Sarah,</p>
            <p>Really enjoyed chatting earlier. My details are in my signature below — feel free to reach out anytime.</p>
            <p>Best,</p>
          </div>

          {/* signature */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-[14px] text-slate-900 mb-2"><strong>Alex Morgan</strong> <span className="text-slate-500">| Morgan &amp; Co.</span></p>
            <div className="relative w-[300px] max-w-full transition-transform hover:-translate-y-0.5">
              <div className="rounded-2xl overflow-hidden shadow-[0_10px_30px_-14px_rgba(8,10,18,0.4)]" style={{ pointerEvents: "none", background: "#FAF7F2" }}>
                <CardScaler><PhotoFirst data={CARD_DATA} /></CardScaler>
              </div>
              <button onClick={() => setOpen(true)} aria-label="Open Alex Morgan's SwiftCard" className="absolute inset-0 z-10 rounded-2xl cursor-pointer" />
            </div>
            <button onClick={() => setOpen(true)} className="inline-block mt-2 text-[14px] font-bold no-underline" style={{ color: "#2563eb" }}>Contact me →</button>
          </div>
        </div>
      </div>

      {open && typeof document !== "undefined" && createPortal(<SwiftCardPopup onClose={() => setOpen(false)} />, document.body)}
    </div>
  );
}
