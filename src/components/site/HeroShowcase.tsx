"use client";

import { useEffect, useRef, useState } from "react";
import CardScaler from "@/components/CardScaler";
import SocialIcons, { type BrandSocial } from "@/components/SocialIcons";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import LogoFirst from "@/components/card-templates/LogoFirst";
import type { CardData } from "@/components/card-templates/types";
import { getLook, hexAlpha, type SwiftLinkLook } from "@/lib/swiftlink-looks";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";

// ── The hero's rotating persona showcase (owner order 2026-08-26, modeled on
//    link.me's front page) ────────────────────────────────────────────────────
//
// Three panels per persona, and each one is a faithful miniature of the REAL
// product surface (owner order 2026-08-26: "have to look exactly like" the
// real thing, nothing tucked under the phone, everything noticeable):
//   CENTER — the SwiftCard link as a visitor opens it: the real template
//            render inside a phone on the card page's cream wash, with the
//            page's Save Contact / Share your info actions in the card accent.
//   LEFT   — the persona's full Swift Links page, rebuilt from the live
//            page's own markup (hero photo/logo with the fade-into-sheet,
//            32px name + verified seal, @handle, the REAL SocialIcons brand
//            row, the Connect button, compact link rows and a featured tile
//            with the shine sweep, the Made-with footer) rendered at the
//            page's natural 430px width and scaled down as one unit.
//   RIGHT  — their Swift Signature as it sits in a received email: message
//            lines, the sign-off, and the same card as the clickable image.
//
// Three personas lead with a headshot (Unsplash-licensed) and three with a
// company logo — matching how real cards split. Display-only: pointer-events
// are dead across the whole stage; nothing here downloads, posts, or
// navigates. Respects prefers-reduced-motion (no timer, first persona static).

type Persona = {
  key: string;
  job: string;
  Template: React.ComponentType<{ data: CardData }>;
  data: CardData;
  look: SwiftLinkLook;
  handle: string;
  subtitle: string;
  accent: string;
  socials: BrandSocial[];
  /** The card page's action-link rows AND the Swift Links grid: [emoji, label]. */
  rows: Array<[string, string]>;
  /** Four half-width Swift Links grid tiles: [emoji, label]. */
  grid: Array<[string, string]>;
  signoff: string;
};

const p = (partial: Omit<CardData, "initials"> & { initials?: string }): CardData => ({
  initials: partial.name.split(" ").map((n) => n[0]).join("").slice(0, 2),
  photoUrl: null,
  logoUrl: null,
  ...partial,
});

// The live page stores each social's brand color on the row (SocialIcons
// falls back to a washed neutral without one) — mirror that here.
const BRAND: Record<string, string> = {
  LinkedIn: "#0A66C2", Facebook: "#1877F2", YouTube: "#FF0000",
  "X / Twitter": "#000000", TikTok: "#010101",
};
const soc = (labels: Array<[string, string]>): BrandSocial[] =>
  labels.map(([label, href]) => ({ label, href, color: BRAND[label] }));

const PERSONAS: Persona[] = [
  {
    key: "realtor", job: "Realtor", Template: PhotoFirst, handle: "mayasellshomes",
    subtitle: "Realtor® · Harbor & Vine Realty", accent: "#7C3AED",
    data: p({
      name: "Maya Castillo", title: "Realtor®", company: "Harbor & Vine Realty",
      phone: "(415) 555-0132", email: "maya@harborvine.com", website: "harborvine.com",
      cardUrl: "swiftcard.me/mayacastillo", photoUrl: "/showcase/maya.jpg",
      customization: { accentColor: "#7C3AED" },
    }),
    look: getLook("nebula"),
    socials: soc([["Instagram", "#"], ["LinkedIn", "#"], ["Facebook", "#"], ["YouTube", "#"]]),
    rows: [["🏡", "Current listings"], ["📅", "Book a private showing"]],
    grid: [["🔑", "Just listed"], ["🏡", "Open houses"], ["⭐", "Client reviews"], ["🧮", "Home valuation"]],
    signoff: "Talk soon,",
  },
  {
    key: "electrician", job: "Electrician", Template: LocalBusiness, handle: "delgadoelectric",
    subtitle: "Licensed & insured · Austin, TX", accent: "#B45309",
    data: p({
      name: "Ray Delgado", title: "Master Electrician", company: "Delgado Electric",
      phone: "(512) 555-0177", email: "ray@delgadoelectric.com", website: "delgadoelectric.com",
      cardUrl: "swiftcard.me/raydelgado", logoUrl: "/showcase/delgado-electric.svg",
    }),
    look: getLook("sand"),
    socials: soc([["Instagram", "#"], ["Facebook", "#"], ["YouTube", "#"]]),
    rows: [["⚡", "Request a free quote"], ["⭐", "Read our 5-star reviews"]],
    grid: [["⚡", "Free quote"], ["🔌", "EV chargers"], ["⭐", "Reviews"], ["🧰", "Our services"]],
    signoff: "Thanks,",
  },
  {
    key: "insurance", job: "Insurance agent", Template: ClassicPro, handle: "danawhitfield",
    subtitle: "Insurance Advisor · Beacon Mutual", accent: "#1D4ED8",
    data: p({
      name: "Dana Whitfield", title: "Insurance Advisor", company: "Beacon Mutual",
      phone: "(303) 555-0149", email: "dana@beaconmutual.com", website: "beaconmutual.com",
      cardUrl: "swiftcard.me/danawhitfield", photoUrl: "/showcase/dana.jpg",
    }),
    look: getLook("paper"),
    socials: soc([["LinkedIn", "#"], ["Facebook", "#"], ["X / Twitter", "#"]]),
    rows: [["🛡️", "Free coverage review"], ["📄", "Start a claim"]],
    grid: [["🛡️", "Coverage review"], ["🏠", "Home + auto"], ["👨‍👩‍👧", "Life insurance"], ["📄", "Start a claim"]],
    signoff: "Best regards,",
  },
  {
    key: "banker", job: "Private banker", Template: LuxuryMinimal, handle: "prestoncole",
    subtitle: "Private Banker · Meridian Private Bank", accent: "#8C6D3F",
    data: p({
      name: "Preston Cole", title: "Private Banker", company: "Meridian Private Bank",
      phone: "(212) 555-0186", email: "pcole@meridianpb.com", website: "meridianpb.com",
      cardUrl: "swiftcard.me/prestoncole", logoUrl: "/showcase/meridian-bank.svg",
    }),
    look: getLook("chrome"),
    socials: soc([["LinkedIn", "#"], ["X / Twitter", "#"]]),
    rows: [["🗓️", "Schedule a consultation"], ["📈", "Quarterly market briefing"]],
    grid: [["🗓️", "Consultation"], ["📈", "Market briefing"], ["🏛️", "Wealth guide"], ["🔐", "Client portal"]],
    signoff: "Kind regards,",
  },
  {
    key: "lawyer", job: "Attorney", Template: ModernBold, handle: "adlergrant",
    subtitle: "Managing Partner · Adler & Grant LLP", accent: "#0F172A",
    data: p({
      name: "Simone Adler", title: "Managing Partner", company: "Adler & Grant LLP",
      phone: "(646) 555-0121", email: "sadler@adlergrant.law", website: "adlergrant.law",
      cardUrl: "swiftcard.me/simoneadler", photoUrl: "/showcase/simone.jpg",
    }),
    look: getLook("midnight"),
    socials: soc([["LinkedIn", "#"], ["X / Twitter", "#"], ["Instagram", "#"]]),
    rows: [["⚖️", "Free case evaluation"], ["🏛️", "Practice areas"]],
    grid: [["⚖️", "Case evaluation"], ["🏛️", "Practice areas"], ["📚", "Client results"], ["📰", "In the news"]],
    signoff: "Sincerely,",
  },
  {
    key: "cars", job: "Car salesperson", Template: LogoFirst, handle: "tonymarchetti",
    subtitle: "Sales Manager · Marchetti Motors", accent: "#DC2626",
    data: p({
      name: "Tony Marchetti", title: "Sales Manager", company: "Marchetti Motors",
      phone: "(702) 555-0166", email: "tony@marchettimotors.com", website: "marchettimotors.com",
      cardUrl: "swiftcard.me/tonymarchetti", logoUrl: "/showcase/marchetti-motors.svg",
      customization: { accentColor: "#DC2626" },
    }),
    look: getLook("onyx"),
    socials: soc([["Instagram", "#"], ["TikTok", "#"], ["YouTube", "#"], ["Facebook", "#"]]),
    rows: [["🚗", "Browse new inventory"], ["🔑", "Book a test drive"]],
    grid: [["🚗", "New inventory"], ["🔑", "Book a test drive"], ["🏁", "Weekly deals"], ["💰", "Trade-in offer"]],
    signoff: "Drive safe,",
  },
];

// SwiftLinkButtons' exact fallback gradients — a real page's grid tiles with
// no preview image look precisely like this, indexed so neighbours differ.
const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #4338ca 0%, #7c3aed 55%, #db2777 100%)",
  "linear-gradient(135deg, #0e7490 0%, #2563eb 60%, #4f46e5 100%)",
  "linear-gradient(135deg, #b45309 0%, #dc2626 60%, #be185d 100%)",
  "linear-gradient(135deg, #065f46 0%, #0d9488 60%, #0284c7 100%)",
];

const ROTATE_MS = 5200;

// The Swift Links page's natural column width — the mini renders the page at
// this width and scales the whole thing down as one unit, so every proportion
// (name size, chip size, tile radius) is exactly the live page's.
const LINKS_NATURAL_W = 430;
const LINKS_NATURAL_H = 980;
const LINKS_SCALE = 0.46;
const LINKS_W = Math.round(LINKS_NATURAL_W * LINKS_SCALE); // 198
const LINKS_H = Math.round(LINKS_NATURAL_H * LINKS_SCALE); // 451

/** The blue scalloped verified seal from the live Swift Links page. */
function Verified({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} className="shrink-0" aria-hidden="true">
      <path d="M12 1.5l2.35 2.03 3.08-.45 1.07 2.92 2.92 1.07-.45 3.08L23 12l-2.03 2.35.45 3.08-2.92 1.07-1.07 2.92-3.08-.45L12 23l-2.35-2.03-3.08.45-1.07-2.92-2.92-1.07.45-3.08L1 12l2.03-2.35-.45-3.08 2.92-1.07 1.07-2.92 3.08.45L12 1.5z" fill="#2196F3" />
      <path d="M7.5 12.2l3 3 6-6.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** LEFT — the persona's Swift Links page, the live page's own layout at 430px scaled down. */
function MiniLinks({ persona }: { persona: Persona }) {
  const L = persona.look;
  const light = L.mode === "light";
  const text = L.text;
  const first = persona.data.name.split(" ")[0];
  const sheetBg = L.sheetTo ? `linear-gradient(180deg, ${L.sheet} 0%, ${L.sheetTo} 100%)` : L.sheet;
  return (
    <div style={{ width: LINKS_W, height: LINKS_H }} className="overflow-hidden rounded-[16px]">
      <div
        className="origin-top-left flex flex-col"
        style={{ width: LINKS_NATURAL_W, height: LINKS_NATURAL_H, transform: `scale(${LINKS_SCALE})` }}
      >
        {/* Hero — headshot cropped full-bleed, or the company logo shown whole
            on the page's gradient, exactly the live fallback order. */}
        <div className="relative w-full h-[430px] shrink-0 overflow-hidden">
          {persona.data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={persona.data.photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center p-[18%] pb-[136px]"
              style={{ background: "linear-gradient(160deg, #181538 0%, #2A2466 60%, #4338ca 100%)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={persona.data.logoUrl!} alt="" className="max-w-full max-h-full w-auto h-auto object-contain" />
            </div>
          )}
          <div
            className="absolute inset-x-0 bottom-0 h-32"
            style={{ background: `linear-gradient(180deg, ${hexAlpha(L.sheet, 0)} 0%, ${L.sheet} 100%)` }}
          />
        </div>

        {/* Sheet */}
        <div className="relative -mt-10 rounded-t-[30px] px-4 pt-7 pb-9 text-center flex-1" style={{ background: sheetBg }}>
          <div className="flex items-start justify-center gap-1.5 px-2">
            <h3 className="font-extrabold" style={{ fontSize: 32, letterSpacing: "0.25px", lineHeight: 1.15, color: text }}>
              {persona.data.name}
            </h3>
            <span className="shrink-0 mt-1.5"><Verified /></span>
          </div>
          <p className="text-[15px] mt-0.5" style={{ color: text, opacity: 0.5 }}>@{persona.handle}</p>
          <p className="text-[13px] font-medium mt-2" style={{ color: text, opacity: 0.6 }}>{persona.subtitle}</p>

          {/* The REAL brand icon row */}
          <SocialIcons socials={persona.socials} mode={L.mode} accent={L.accent} accentText={L.accentText} />

          {/* Connect — the page's hero action */}
          <div className="w-full mt-6 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[15px]" style={{ background: L.accent, color: L.accentText }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            Connect with {first}
          </div>

          {/* Links — the live tile system's GRID: half-width 1.91:1 tiles
              packing in pairs, gradient fallback, bottom scrim, centered
              title, shine sweep — SwiftLinkButtons' own classes. */}
          <div className="w-full mt-6 flex flex-wrap justify-between">
            {persona.grid.map(([emoji, label], i) => (
              <div key={label} className="relative overflow-hidden rounded-[14px] mb-2.5 block aspect-[1.91/1] w-[calc(50%-6px)]" style={{ background: L.tile }}>
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length] }}>
                  <span className="text-4xl drop-shadow">{emoji}</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-[70%]" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)" }} />
                <span className="absolute inset-x-0 bottom-[7px] z-[6] px-2 flex justify-center">
                  <span className="font-semibold text-center leading-[1.3] text-[16px]" style={{ color: "#ffffff", textShadow: "0 1px 8px rgba(0,0,0,0.6)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {label}
                  </span>
                </span>
                <span className="sc-hs-shine" aria-hidden="true" />
              </div>
            ))}
          </div>

          {/* Made-with footer, every real profile carries it */}
          <div className="flex justify-center mt-6">
            <span className="flex items-center gap-1.5 text-[11px] opacity-40" style={{ color: text }}>
              <svg viewBox="0 0 100 100" className="w-3 h-3 shrink-0">
                <polygon points="57,15 38,52 50,52 43,85 62,48 50,48" fill="currentColor" />
              </svg>
              <span>Made with <span className="underline underline-offset-2">swiftcard.me</span></span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** RIGHT — the Swift Signature as it lands in a received email. */
function MiniSignature({ persona }: { persona: Persona }) {
  const { Template } = persona;
  return (
    <div className="w-[200px] rounded-[18px] overflow-hidden bg-white flex flex-col px-3.5 pt-3.5 pb-3">
      <div className="space-y-1.5" aria-hidden="true">
        <div className="h-[6px] w-11/12 rounded-full bg-slate-200/80" />
        <div className="h-[6px] w-8/12 rounded-full bg-slate-200/80" />
      </div>
      <p className="mt-2.5 text-[10px] text-slate-600 leading-snug">{persona.signoff}</p>
      <p className="text-[11px] font-bold text-slate-900 leading-snug">{persona.data.name.split(" ")[0]}</p>
      <div className="mt-2 rounded-lg overflow-hidden ring-1 ring-slate-200">
        <CardScaler>
          <Template data={persona.data} />
        </CardScaler>
      </div>
      <p className="mt-1.5 text-[7.5px] text-slate-400 text-center">Swift Signature · tap to open card</p>
    </div>
  );
}

/** CENTER — the SwiftCard link, as a visitor opens it on their phone. The
 *  live card page top to bottom at mini scale: accent-washed cream, the card,
 *  Save Contact / Share your info, the links table, and the Share-this-card
 *  section with the page's real "Create your free SwiftCard" gradient CTA. */
function PhoneCard({ persona }: { persona: Persona }) {
  const { Template } = persona;
  return (
    <div
      className="w-full h-full rounded-[30px] overflow-hidden flex flex-col"
      style={{ background: `linear-gradient(180deg, ${hexAlpha(persona.accent, 0.14)} 0%, rgba(250,247,242,0) 46%), #FAF7F2` }}
    >
      {/* status strip */}
      <div className="flex items-center justify-between px-5 pt-2.5 pb-1" aria-hidden="true">
        <span className="text-[9px] font-semibold text-slate-700">9:41</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-[7px] rounded-[2px] border border-slate-500/70 relative"><span className="absolute inset-[1px] right-[3px] bg-slate-600 rounded-[1px]" /></span>
        </span>
      </div>
      <div className="px-2.5 mt-0.5">
        <CardScaler>
          <Template data={persona.data} />
        </CardScaler>
      </div>
      <div className="px-4 mt-3 space-y-1.5">
        <div className="flex items-center justify-center gap-1.5 rounded-full py-2 text-white text-[11px] font-bold shadow-sm" style={{ background: persona.accent }}>
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0" /></svg>
          Save Contact
        </div>
        <div className="flex items-center justify-center rounded-full py-2 text-[11px] font-semibold" style={{ background: "#fff", border: "1px solid #E4DDD4", color: "#475569" }}>
          Share your info
        </div>
      </div>

      {/* Links — the page's hairline-ruled action-link table, mini */}
      <div className="mx-4 mt-3 rounded-[12px] overflow-hidden bg-white" style={{ boxShadow: "inset 0 0 0 1px #E7E0D7, 0 1px 2px rgba(15,23,42,0.04)" }}>
        {persona.rows.map(([emoji, label], i) => (
          <div key={label} className={`flex items-center gap-2 px-2.5 py-2 ${i > 0 ? "border-t border-[#F1EBE3]" : ""}`}>
            <span className="shrink-0 w-5 h-5 rounded-[6px] bg-[#FAF7F2] grid place-items-center" style={{ boxShadow: "inset 0 0 0 1px #EDE6DC" }}>
              <span className="text-[10px] leading-none">{emoji}</span>
            </span>
            <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-[#1E293B]">{label}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="#C9BFB2" strokeWidth={2.5} className="w-2.5 h-2.5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        ))}
      </div>

      {/* Share this card (the page's CTA button is deliberately left off the demo phone — owner order 2026-08-26) */}
      <div className="mx-4 mt-3 rounded-[14px] p-2.5" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
        <div className="flex items-center justify-center gap-1.5 rounded-full py-2 text-[10.5px] font-semibold text-slate-700" style={{ border: "1px solid #E4DDD4" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
          Share this card
        </div>
      </div>

      <p className="mt-auto pb-2.5 text-center text-[8px] text-slate-400">{persona.data.cardUrl}</p>
    </div>
  );
}

export default function HeroShowcase() {
  const [idx, setIdx] = useState(0);
  const [entered, setEntered] = useState(true);
  const reduced = useRef(false);

  useEffect(() => {
    try {
      reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch { /* default: animate */ }
    if (reduced.current) return;
    const t = setInterval(() => {
      setEntered(false);
      // Brief out-phase (flankers slide back out, center fades) then swap.
      setTimeout(() => {
        setIdx((i) => (i + 1) % PERSONAS.length);
        setEntered(true);
      }, 380);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  const persona = PERSONAS[idx];

  return (
    <div className="relative w-[692px] h-[680px] select-none pointer-events-none" aria-label={`Example SwiftCard: ${persona.job}`}>
      {/* Every persona's photo/logo, loaded once up front — panels remount on
          each swap, and without this the hero flashes empty for the first
          cycle while the next image fetches. */}
      <div className="hidden" aria-hidden="true">
        {PERSONAS.flatMap((pp) => [pp.data.photoUrl, pp.data.logoUrl]).filter(Boolean).map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src!} alt="" />
        ))}
      </div>

      {/* job tag */}
      <div className="absolute top-0 left-[350px] -translate-x-1/2 z-40">
        <span
          key={persona.key + "-tag"}
          className={`sc-hs-fade inline-block rounded-full bg-white/90 backdrop-blur px-3.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm border border-slate-200/70 ${entered ? "" : "sc-hs-hidden"}`}
        >
          {persona.job}
        </span>
      </div>

      {/* CENTER — the phone. Crossfades between personas (link.me's center). */}
      <div className="absolute left-[210px] top-[34px] z-20 w-[280px] h-[600px] rounded-[38px] bg-slate-900 p-[7px] shadow-[0_40px_90px_-30px_rgba(8,10,18,0.6)]">
        <div key={persona.key + "-phone"} className={`sc-hs-fade w-full h-full ${entered ? "" : "sc-hs-hidden"}`}>
          <PhoneCard persona={persona} />
        </div>
      </div>

      {/* LEFT flanker — the full Swift Links page. IN FRONT of the phone's
          edge (owner: nothing may hide under the phone), sliding in from the
          left and drifting while visible. */}
      <div className="absolute left-0 top-[104px] z-10 rounded-[16px] shadow-[0_28px_60px_-20px_rgba(8,10,18,0.55)] ring-1 ring-black/5 sc-hs-drift">
        <div key={persona.key + "-links"} className={`sc-hs-slide-l ${entered ? "" : "sc-hs-hidden-l"}`}>
          <MiniLinks persona={persona} />
        </div>
      </div>

      {/* RIGHT flanker — Swift Signature, slides in from the right, sits low. */}
      <div className="absolute right-0 bottom-[70px] z-10 rounded-[18px] shadow-[0_24px_50px_-18px_rgba(8,10,18,0.5)] ring-1 ring-black/5 sc-hs-drift" style={{ animationDelay: "1.4s" }}>
        <div key={persona.key + "-sig"} className={`sc-hs-slide-r ${entered ? "" : "sc-hs-hidden-r"}`}>
          <MiniSignature persona={persona} />
        </div>
      </div>

      <style>{`
        .sc-hs-fade { transition: opacity 0.38s ease; opacity: 1; }
        .sc-hs-hidden { opacity: 0; }
        .sc-hs-slide-l { transition: opacity 0.42s ease, transform 0.42s cubic-bezier(0.25,1,0.5,1); opacity: 1; transform: translateX(0); }
        .sc-hs-hidden-l { opacity: 0; transform: translateX(-32px); }
        .sc-hs-slide-r { transition: opacity 0.42s ease, transform 0.42s cubic-bezier(0.25,1,0.5,1); opacity: 1; transform: translateX(0); }
        .sc-hs-hidden-r { opacity: 0; transform: translateX(32px); }
        @keyframes sc-hs-drift { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .sc-hs-drift { animation: sc-hs-drift 4.2s ease-in-out infinite; }
        @keyframes sc-hs-shine { 0% { transform: translateX(-160%) skewX(-18deg); } 55%, 100% { transform: translateX(320%) skewX(-18deg); } }
        .sc-hs-shine { position: absolute; top: -10%; bottom: -10%; left: 0; width: 45%; pointer-events: none;
          background: linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0) 100%);
          animation: sc-hs-shine 3.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sc-hs-fade, .sc-hs-slide-l, .sc-hs-slide-r { transition: none; }
          .sc-hs-drift, .sc-hs-shine { animation: none; }
        }
      `}</style>
    </div>
  );
}
