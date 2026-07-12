"use client";

import { useState } from "react";
import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import { SAMPLE_DATA, withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";
import SocialLinkIntercept from "@/components/SocialLinkIntercept";
import ShareButton from "@/components/ShareButton";
import QRCodeModal from "@/components/QRCodeModal";
import { buildConnectLinks } from "@/lib/social-url";

// Interactive template gallery for the homepage. It renders the REAL card
// templates (same components, same sample data as /templates and the live
// /card pages) so what people see here is identical to the card they'd ship.
// Hovering a template swaps the phone to that template's actual link
// experience — the card plus the Save-contact / Share-info / Swift Links /
// Share sections, exactly like opening a SwiftCard link. All interactions are
// local, so nothing here ever counts as real traffic.

const CARD: CardData = withoutSocials(SAMPLE_DATA);
const FIRST = SAMPLE_DATA.name.split(" ")[0];
const DEMO_URL = "https://swiftcard.me/card/alexmorgan";

// Photo First is face-forward, so it gets a real headshot (royalty-free portrait).
const PHOTO_FIRST_DATA: CardData = { ...CARD, photoUrl: "/marketing/demo-girl.jpg" };

// Same connect links the live card builds (Website, LinkedIn, Instagram, TikTok, X).
const CONNECT_LINKS = buildConnectLinks({
  website: SAMPLE_DATA.website,
  linkedin: SAMPLE_DATA.linkedin,
  instagram: SAMPLE_DATA.instagram,
  tiktok: SAMPLE_DATA.tiktok,
  twitter: SAMPLE_DATA.twitter,
});

type Tmpl = { id: string; name: string; Component: React.ComponentType<{ data: CardData }>; data?: CardData };

const TEMPLATES: Tmpl[] = [
  { id: "classic-pro", name: "Classic Professional", Component: ClassicPro },
  { id: "modern-bold", name: "Modern Bold", Component: ModernBold },
  { id: "photo-first", name: "Photo First", Component: PhotoFirst, data: PHOTO_FIRST_DATA },
  { id: "local-business", name: "Local Business", Component: LocalBusiness },
  { id: "luxury-minimal", name: "Luxury Minimal", Component: LuxuryMinimal },
];

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

function SectionNum({ n }: { n: number }) {
  return <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white" style={{ background: "#1D4ED8" }}>{n}</span>;
}

const Panel = "w-full rounded-2xl p-4 shadow-sm";
const panelStyle = { background: "#fff", border: "1px solid #E4DDD4" } as const;

// The full "what you get when you open the link" experience for one template.
// Keyed on the template id by the parent, so switching templates resets state.
function LinkExperience({ Component, data }: { Component: Tmpl["Component"]; data: CardData }) {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);

  return (
    <div className="px-4 pt-2 pb-8" style={{ background: "#FAF7F2" }}>
      <div className="mx-auto max-w-[300px] flex flex-col gap-4">
        {/* The real card template — contact links are display-only in the demo */}
        <div className="rounded-2xl overflow-hidden" style={{ pointerEvents: "none" }}>
          <CardScaler><Component data={data} /></CardScaler>
        </div>

        {/* 1 — Save contact */}
        <div className={Panel} style={panelStyle}>
          <div className="flex items-center gap-2.5 mb-2">
            <SectionNum n={1} />
            <p className="text-slate-900 font-semibold text-[13px]">Save {FIRST}&apos;s contact</p>
          </div>
          <button
            onClick={() => setSaved(true)}
            className="w-full rounded-full py-2.5 text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 transition-colors"
            style={{ background: saved ? "#16a34a" : "#2563EB" }}
          >
            {saved ? (
              <><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>Saved to Contacts</>
            ) : (
              <><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21v-8H5v8M5 3h11l3 3v3M9 3v4h6" strokeLinecap="round" strokeLinejoin="round" /></svg>Save {FIRST}&apos;s contact</>
            )}
          </button>
        </div>

        {/* 2 — Share your info back */}
        <div className={Panel} style={panelStyle}>
          <div className="flex items-center gap-2.5 mb-2">
            <SectionNum n={2} />
            <p className="text-slate-900 font-semibold text-[13px]">Share your info with {FIRST}</p>
          </div>
          {shared ? (
            <div className="py-3 text-center">
              <div className="w-10 h-10 mx-auto mb-1.5 rounded-full bg-green-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <p className="text-slate-900 font-bold text-[13px]">Info shared!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {["Full name", "Email address", "Phone number"].map((ph) => (
                <div key={ph} className="h-9 rounded-lg bg-white flex items-center px-3 text-[12px] text-slate-400" style={{ border: "1px solid #E4DDD4" }}>{ph}</div>
              ))}
              <button onClick={() => setShared(true)} className="mt-1 w-full h-10 rounded-lg text-white text-[12.5px] font-bold flex items-center justify-center" style={{ background: "#2563EB" }}>Share my info →</button>
            </div>
          )}
        </div>

        {/* 3 — Swift Links (the real card component) */}
        <div className={Panel} style={panelStyle}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <SectionNum n={3} />
              <p className="text-slate-900 font-semibold text-[13px]">Swift Links</p>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-slate-400">Go to Swift Links →</span>
          </div>
          <div style={{ pointerEvents: "none" }}>
            <SocialLinkIntercept links={CONNECT_LINKS} cardOwner="alexmorgan" ownerFirstName={FIRST} />
          </div>
        </div>

        {/* 4 — Share this card (the real card components) */}
        <div className={Panel} style={panelStyle}>
          <div className="flex items-center gap-2.5 mb-4">
            <SectionNum n={4} />
            <p className="text-slate-900 font-semibold text-[13px]">Share this card</p>
          </div>
          <div style={{ pointerEvents: "none" }}>
            <ShareButton url={DEMO_URL} text={`Connect with ${FIRST} — save their contact instantly.`} label="Share this card" />
            <QRCodeModal url={DEMO_URL} firstName={FIRST} />
          </div>
          <a href="https://swiftcard.me/?src=card" className="block text-center text-slate-400 hover:text-slate-600 text-[11px] mt-3 transition-colors">
            Create your card · swiftcard.me
          </a>
        </div>
      </div>
    </div>
  );
}

export default function TemplateGallery() {
  const [active, setActive] = useState(TEMPLATES[0].id);
  const activeT = TEMPLATES.find((t) => t.id === active) ?? TEMPLATES[0];

  return (
    <div className="grid lg:grid-cols-[0.82fr_1.18fr] gap-12 items-start">
      {/* Phone — reflects the hovered template's live link experience */}
      <div className="flex flex-col items-center gap-3 order-2 lg:order-1 lg:sticky lg:top-24">
        <div className="flex items-center gap-1.5 text-slate-400 text-[12px] font-medium">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M12 19l-4-4M12 19l4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Scroll on phone to view
        </div>
        <div className="rd-phone w-[300px]">
          <div className="rd-phone-screen h-[600px]" style={{ background: "#FAF7F2" }}>
            <div className="rd-notch" />
            <div className="absolute inset-0 overflow-y-auto rd-scrollbar-none">
              <StatusBar />
              <LinkExperience key={activeT.id} Component={activeT.Component} data={activeT.data ?? CARD} />
            </div>
            <div className="pointer-events-none absolute inset-0 z-10" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 26%)" }} />
          </div>
        </div>
      </div>

      {/* Template grid — every real template, name above each */}
      <div className="order-1 lg:order-2">
        <p className="text-slate-400 text-[13px] font-semibold uppercase tracking-wide mb-5" data-reveal="fade">
          Five designer templates — hover any to see it live
        </p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-7">
          {TEMPLATES.map((t, i) => {
            const on = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onMouseEnter={() => setActive(t.id)}
                onFocus={() => setActive(t.id)}
                onClick={() => setActive(t.id)}
                className="text-left outline-none"
                data-reveal
                style={{ transitionDelay: `${i * 70}ms` }}
                aria-pressed={on}
              >
                <p className={`text-[13.5px] font-semibold mb-2 transition-colors ${on ? "text-[#2563EB]" : "text-slate-700"}`}>{t.name}</p>
                <div
                  className="rounded-2xl overflow-hidden transition-all duration-200"
                  style={{
                    outline: on ? "2px solid #2563EB" : "2px solid transparent",
                    outlineOffset: 3,
                    boxShadow: on ? "0 18px 36px -16px rgba(37,99,235,0.55)" : "0 8px 20px -14px rgba(8,10,18,0.4)",
                    transform: on ? "translateY(-3px)" : undefined,
                    // Card contact links (phone/email/website) are display-only here —
                    // pointer events pass through to the selector button.
                    pointerEvents: "none",
                  }}
                >
                  <CardScaler><t.Component data={t.data ?? CARD} /></CardScaler>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
