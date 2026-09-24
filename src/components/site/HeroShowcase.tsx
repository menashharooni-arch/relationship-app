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
import { getLook, hexAlpha, fallbackTile, type SwiftLinkLook } from "@/lib/swiftlink-looks";
import PlatformIcon from "@/components/PlatformIcon";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import PhoneFrame from "@/components/PhoneFrame";

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
  bio: string;
  /** Subject line of the email the Swift Signature sits in. */
  subject: string;
  accent: string;
  socials: BrandSocial[];
  /** The page's ONE featured tile - full width, the thing they most want tapped. */
  featured: string;
  /** Two half-width grid tiles, side by side under the featured one. */
  grid: string[];
  /** One compact row - the quiet link at the bottom of a real page. */
  compact: string;
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

const SERIF = "Georgia, 'Times New Roman', serif";

// Every example is DESIGNED, not default (owner, 2026-09-17: "make all those
// designs much nicer... play with all the features"). Each persona uses the
// real systems a paying customer has:
//   - the card's style controls (bgColor / surfaceColor / textColor /
//     fontFamily) plus a finish (sheen, frosted, brushed, carbon, gilt, halo),
//     the same values the named presets in lib/template-style-presets.ts carry;
//   - a Swift Links Look from lib/swiftlink-looks - the glass and gradient
//     ones, not just the flat defaults;
//   - the whole link-tile system: one FEATURED tile, a GRID pair and a COMPACT
//     row, which is what SwiftLinkButtons renders for a paid page.
const PERSONAS: Persona[] = [
  {
    key: "realtor", job: "Realtor", Template: PhotoFirst, handle: "mayasellshomes",
    subtitle: "Realtor® · Harbor & Vine Realty", accent: "#6D28D9",
    bio: "Helping Bay Area families find home for 12 years. 200+ closings and counting.",
    subject: "Re: 12 Harbor Lane — Saturday showing",
    data: p({
      name: "Maya Castillo", title: "Realtor®", company: "Harbor & Vine Realty",
      phone: "(415) 555-0132", email: "maya@harborvine.com", website: "harborvine.com",
      cardUrl: "swiftcard.me/mayacastillo", photoUrl: "/showcase/maya.jpg",
      // "Royal Violet" info panel, lit with a soft sheen.
      customization: { accentColor: "#6D28D9", bgColor: "linear-gradient(145deg, #4f46e5 0%, #7c3aed 60%, #6d28d9 100%)", textColor: "#ffffff", finish: "sheen" },
    }),
    look: getLook("aurora"),
    socials: soc([["Instagram", "#"], ["LinkedIn", "#"], ["Facebook", "#"], ["YouTube", "#"]]),
    featured: "Just listed · 12 Harbor Lane",
    grid: ["Open houses", "What's my home worth?"],
    compact: "Book a private showing",
    signoff: "Talk soon,",
  },
  {
    key: "electrician", job: "Electrician", Template: LocalBusiness, handle: "delgadoelectric",
    subtitle: "Licensed & insured · Austin, TX", accent: "#B45309",
    bio: "Licensed master electrician. Same-week service, upfront pricing, 5-star rated.",
    subject: "Re: Your panel upgrade quote",
    data: p({
      name: "Ray Delgado", title: "Master Electrician", company: "Delgado Electric",
      phone: "(512) 555-0177", email: "ray@delgadoelectric.com", website: "delgadoelectric.com",
      cardUrl: "swiftcard.me/raydelgado", logoUrl: "/showcase/delgado-electric.svg",
      // "Warm Amber" header stripe over a warm body.
      customization: { accentColor: "#B45309", bgColor: "linear-gradient(100deg, #b45309 0%, #d97706 60%, #f59e0b 100%)", surfaceColor: "#FFFBF3", textColor: "#ffffff", finish: "sheen" },
    }),
    look: getLook("linen"),
    socials: soc([["Instagram", "#"], ["Facebook", "#"], ["YouTube", "#"]]),
    featured: "Same-week service · Book today",
    grid: ["Free quote", "EV chargers"],
    compact: "Read our 5-star reviews",
    signoff: "Thanks,",
  },
  {
    key: "insurance", job: "Insurance agent", Template: ClassicPro, handle: "danawhitfield",
    subtitle: "Insurance Advisor · Beacon Mutual", accent: "#2F6F8F",
    bio: "Coverage that actually fits your life — home, auto, and everything in between.",
    subject: "Re: Your coverage review",
    data: p({
      name: "Dana Whitfield", title: "Insurance Advisor", company: "Beacon Mutual",
      phone: "(303) 555-0149", email: "dana@beaconmutual.com", website: "beaconmutual.com",
      cardUrl: "swiftcard.me/danawhitfield", photoUrl: "/showcase/dana.jpg",
      // "Sea Glass": frosted navy panel, pale ink, bright info surface.
      customization: { accentColor: "#2F6F8F", bgColor: "linear-gradient(160deg, #1c3a5e 0%, #2f6f8f 100%)", textColor: "#f2fbff", surfaceColor: "#f8fafc", finish: "frosted" },
    }),
    look: getLook("tide"),
    socials: soc([["LinkedIn", "#"], ["Facebook", "#"], ["X / Twitter", "#"]]),
    featured: "Free 10-minute coverage review",
    grid: ["Home + auto", "Life insurance"],
    compact: "Start a claim",
    signoff: "Best regards,",
  },
  {
    key: "banker", job: "Private banker", Template: LuxuryMinimal, handle: "prestoncole",
    subtitle: "Private Banker · Meridian Private Bank", accent: "#8C6D3F",
    bio: "Discreet wealth management for founders, families, and funds.",
    subject: "Re: Q3 portfolio review",
    data: p({
      name: "Preston Cole", title: "Private Banker", company: "Meridian Private Bank",
      phone: "(212) 555-0186", email: "pcole@meridianpb.com", website: "meridianpb.com",
      cardUrl: "swiftcard.me/prestoncole", logoUrl: "/showcase/meridian-bank.svg",
      // "Ivory & Gold", set in a serif, with the gilt edge.
      customization: { accentColor: "#8C6D3F", bgColor: "#FAFAF6", textColor: "#1C1612", fontFamily: SERIF, finish: "gilt" },
    }),
    look: getLook("chrome"),
    socials: soc([["LinkedIn", "#"], ["X / Twitter", "#"]]),
    featured: "Q3 market briefing",
    grid: ["Book a consultation", "Wealth guide"],
    compact: "Client portal",
    signoff: "Kind regards,",
  },
  {
    key: "lawyer", job: "Attorney", Template: ModernBold, handle: "adlergrant",
    subtitle: "Managing Partner · Adler & Grant LLP", accent: "#5B8DEF",
    bio: "Trial-tested counsel for businesses and the people who run them.",
    subject: "Re: Your consultation on Thursday",
    data: p({
      name: "Simone Adler", title: "Managing Partner", company: "Adler & Grant LLP",
      phone: "(646) 555-0121", email: "sadler@adlergrant.law", website: "adlergrant.law",
      cardUrl: "swiftcard.me/simoneadler", photoUrl: "/showcase/simone.jpg",
      // "Carbon": woven black, cool blue accent.
      customization: { accentColor: "#5B8DEF", bgColor: "#0B0F16", textColor: "#ffffff", finish: "carbon" },
    }),
    look: getLook("graphite"),
    socials: soc([["LinkedIn", "#"], ["X / Twitter", "#"], ["Instagram", "#"]]),
    featured: "Free case evaluation",
    grid: ["Practice areas", "Client results"],
    compact: "In the news",
    signoff: "Sincerely,",
  },
  {
    key: "cars", job: "Car salesperson", Template: LogoFirst, handle: "tonymarchetti",
    subtitle: "Sales Manager · Marchetti Motors", accent: "#DC2626",
    bio: "Your guy for new & certified pre-owned. No games, just great deals.",
    subject: "Re: Your test drive this weekend",
    data: p({
      name: "Tony Marchetti", title: "Sales Manager", company: "Marchetti Motors",
      phone: "(702) 555-0166", email: "tony@marchettimotors.com", website: "marchettimotors.com",
      cardUrl: "swiftcard.me/tonymarchetti", logoUrl: "/showcase/marchetti-motors.svg",
      // "Brushed Steel" - machined metal behind the logo panel.
      customization: { accentColor: "#DC2626", bgColor: "#39414F", textColor: "#ffffff", finish: "brushed" },
    }),
    look: getLook("ember"),
    socials: soc([["Instagram", "#"], ["TikTok", "#"], ["YouTube", "#"], ["Facebook", "#"]]),
    featured: "This week's deals",
    grid: ["New inventory", "Trade-in value"],
    compact: "Book a test drive",
    signoff: "Drive safe,",
  },
];

// Personas that exist for the /for/<industry> landing pages only - the
// homepage rotation stays the six above.
const VERTICAL_PERSONAS: Persona[] = [
  {
    key: "loan-officer", job: "Loan officer", Template: ClassicPro, handle: "marcuswebbloans",
    subtitle: "Senior Loan Officer · Summit Home Loans", accent: "#0F766E",
    bio: "From pre-approval to clear-to-close — I keep buyers, agents, and files moving.",
    subject: "Re: Your pre-approval letter",
    data: p({
      name: "Marcus Webb", title: "Senior Loan Officer", company: "Summit Home Loans",
      phone: "(214) 555-0198", email: "marcus@summithl.com", website: "summithl.com",
      cardUrl: "swiftcard.me/MarcusWebb-SummitHomeLoans", photoUrl: "/showcase/marcus.jpg",
      customization: { accentColor: "#0F766E", bgColor: "#052E2B", textColor: "#ffffff", surfaceColor: "#F7FBFA", finish: "sheen" },
    }),
    look: getLook("meadow"),
    socials: soc([["LinkedIn", "#"], ["Instagram", "#"], ["Facebook", "#"]]),
    featured: "Get pre-approved in 10 minutes",
    grid: ["Payment calculator", "Agent partners"],
    compact: "Client reviews",
    signoff: "Talk soon,",
  },
  {
    key: "photographer", job: "Photographer", Template: PhotoFirst, handle: "lenabrooksphoto",
    subtitle: "Wedding & Portrait Photographer", accent: "#BE123C",
    bio: "Weddings, portraits, and brand shoots — natural light, real moments.",
    subject: "Re: Your gallery is ready",
    data: p({
      name: "Lena Brooks", title: "Photographer", company: "Lena Brooks Photography",
      phone: "(503) 555-0143", email: "hello@lenabrooks.photo", website: "lenabrooks.photo",
      cardUrl: "swiftcard.me/LenaBrooks-LenaBrooksPhotography", photoUrl: "/showcase/lena.jpg",
      customization: { accentColor: "#BE123C", bgColor: "linear-gradient(145deg, #be123c 0%, #f43f5e 100%)", textColor: "#ffffff", finish: "sheen" },
    }),
    look: getLook("bloom"),
    socials: soc([["Instagram", "#"], ["TikTok", "#"], ["YouTube", "#"], ["Facebook", "#"]]),
    featured: "2026 wedding dates",
    grid: ["Portfolio", "Mini sessions"],
    compact: "Client galleries",
    signoff: "With love,",
  },
  {
    key: "barber", job: "Barber & stylist", Template: ModernBold, handle: "zoecuts",
    subtitle: "Master Stylist · Fade District Studio", accent: "#7C3AED",
    bio: "Cuts, color, and fades by appointment. Walk out sharp, every time.",
    subject: "Re: Saturday 2:00 confirmed",
    data: p({
      name: "Zoe Okafor", title: "Master Stylist", company: "Fade District Studio",
      phone: "(404) 555-0169", email: "zoe@fadedistrict.com", website: "fadedistrict.com",
      cardUrl: "swiftcard.me/ZoeOkafor-FadeDistrictStudio", photoUrl: "/showcase/zoe.jpg",
      customization: { accentColor: "#7C3AED", bgColor: "linear-gradient(135deg, #111827 0%, #6d28d9 100%)", textColor: "#ffffff", finish: "halo" },
    }),
    look: getLook("orchid"),
    socials: soc([["Instagram", "#"], ["TikTok", "#"], ["YouTube", "#"]]),
    featured: "Book a chair this week",
    grid: ["Price list", "Transformations"],
    compact: "Products I use",
    signoff: "See you soon,",
  },
];

export const ALL_PERSONAS: Persona[] = [...PERSONAS, ...VERTICAL_PERSONAS];

const ROTATE_MS = 4600;

// The Swift Links page's natural column width — the mini renders the page at
// this width and scales the whole thing down as one unit, so every proportion
// (name size, chip size, tile radius) is exactly the live page's.
const LINKS_NATURAL_W = 430;
const LINKS_NATURAL_H = 1150; // taller since the page gained a featured tile + compact row
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
/** The card page's ambient accent wash — the real page's own background. */
const phoneScreenWash = (accent: string) =>
  `linear-gradient(180deg, ${hexAlpha(accent, 0.14)} 0%, rgba(250,247,242,0) 46%), #FAF7F2`;

function MiniLinks({ persona }: { persona: Persona }) {
  const L = persona.look;
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
              // Derived from the page's own Look (2026-09-17). It used to be a
              // fixed indigo ramp, so an amber electrician or a gilt banker got
              // a purple header that belonged to neither of them.
              style={{ background: `linear-gradient(160deg, ${hexAlpha(L.accent, 0.92)} 0%, ${hexAlpha(L.accent, 0.55)} 55%, ${L.sheet} 100%)` }}
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
          {/* No @handle line — the live page dropped it (owner order 2026-08-26). */}
          <p className="text-[0.8125rem] font-medium mt-2" style={{ color: text, opacity: 0.6 }}>{persona.subtitle}</p>
          <p className="text-sm leading-relaxed mt-3 max-w-[340px] mx-auto" style={{ color: text, opacity: 0.75 }}>{persona.bio}</p>

          {/* The REAL brand icon row */}
          <SocialIcons socials={persona.socials} mode={L.mode} accent={L.accent} accentText={L.accentText} />

          {/* Connect — the page's hero action */}
          <div className="w-full mt-6 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[0.9375rem]" style={{ background: L.accent, color: L.accentText }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            Connect with {first}
          </div>

          {/* Links — all THREE sizes the live tile system renders for a paid
              page (owner, 2026-09-17: "play with all the features"): one
              full-width FEATURED tile, a GRID pair beneath it, then a COMPACT
              row. Gradient fallback, bottom scrim, centered title and the
              shine sweep are SwiftLinkButtons' own. */}
          <div className="w-full mt-6">
            {[{ label: persona.featured, full: true }, ...persona.grid.map((label) => ({ label, full: false }))].map(({ label, full }, i) => {
              // Same call the live page makes, so these tiles ARE the tiles a
              // visitor sees: one brand-derived ramp, indexed so neighbours
              // differ.
              const fb = fallbackTile(L, i);
              return (
              <div
                key={label}
                className={`relative overflow-hidden rounded-[14px] mb-2.5 ${full ? "block w-full aspect-[1.91/1]" : "inline-block align-top aspect-[1.91/1] w-[calc(50%-6px)]"} ${!full && i === 1 ? "mr-[12px]" : ""}`}
                style={{ background: L.tile }}
              >
                <div className="absolute inset-0" style={{ background: fb.background }} />
                <div
                  className="absolute inset-x-0 bottom-0 h-[70%]"
                  style={{
                    background: fb.light
                      ? "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.82) 100%)"
                      : "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)",
                  }}
                />
                <span className="absolute inset-x-0 bottom-[7px] z-[6] px-2 flex justify-center">
                  <span className="font-semibold text-center leading-[1.3]" style={{ fontSize: full ? "1.25rem" : "1rem", color: fb.light ? "#0F172A" : "#ffffff", textShadow: fb.light ? "0 1px 6px rgba(255,255,255,0.7)" : "0 1px 8px rgba(0,0,0,0.6)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {label}
                  </span>
                </span>
                <span className="sc-hs-shine" aria-hidden="true" />
              </div>
              );
            })}

            {/* The compact row: the quiet link at the foot of a real page —
                translucent surface, favicon disc, label on the sheet's ink. */}
            <div
              className="w-full mb-2.5 flex items-center gap-3 rounded-[14px] px-3.5 py-3"
              style={{ background: L.mode === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.10)" }}
            >
              <span
                className="w-[34px] h-[34px] rounded-full shrink-0 grid place-items-center text-[0.8125rem] font-bold"
                style={{ background: L.mode === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.10)", color: text }}
              >
                {(persona.data.website || "s").charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-[0.9375rem] truncate" style={{ color: text }}>{persona.compact}</span>
            </div>
          </div>

          {/* Made-with footer, every real profile carries it */}
          <div className="flex justify-center mt-6">
            <span className="flex items-center gap-2 text-[0.8125rem] opacity-50" style={{ color: text }}>
              <span className="shrink-0 rounded-[4px] overflow-hidden flex"><SwiftCardIcon size={16} /></span>
              <span>Made with <span className="underline underline-offset-2">swiftcard.me</span></span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** RIGHT — the Swift Signature exactly where it lives: at the foot of a
 *  received email, under the sender's reply. */
function MiniSignature({ persona }: { persona: Persona }) {
  const { Template } = persona;
  const first = persona.data.name.split(" ")[0];
  return (
    <div className="w-[200px] rounded-[18px] overflow-hidden bg-white flex flex-col">
      {/* The mail app's own window bar (owner, 2026-09-17: "make it look
          really real") — the signature is something you receive in a mail
          client, so it arrives in one instead of on a bare white slab. */}
      <div className="flex items-center gap-1.5 px-2.5 h-[18px] bg-[#F5F7FB] border-b border-slate-200/80" aria-hidden="true">
        <span className="w-[5px] h-[5px] rounded-full bg-[#ff5f57]" />
        <span className="w-[5px] h-[5px] rounded-full bg-[#febc2e]" />
        <span className="w-[5px] h-[5px] rounded-full bg-[#28c840]" />
        <span className="ml-1 text-[0.4375rem] font-semibold text-slate-400 tracking-wide">Inbox</span>
      </div>
      {/* message header — sender, subject, timestamp */}
      <div className="px-3.5 pt-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {persona.data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={persona.data.photoUrl} alt="" className="w-[22px] h-[22px] rounded-full object-cover shrink-0" />
          ) : (
            <span className="w-[22px] h-[22px] rounded-full grid place-items-center text-[0.5rem] font-black text-white shrink-0" style={{ background: persona.accent }}>
              {persona.data.initials}
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-[0.59375rem] font-bold text-slate-900 leading-tight truncate">{persona.data.name}</span>
            <span className="block text-[0.5rem] text-slate-500 leading-tight truncate">to me · 9:41 AM</span>
          </span>
        </div>
        <p className="mt-1.5 text-[0.5625rem] font-semibold text-slate-700 truncate">{persona.subject}</p>
      </div>
      {/* body + sign-off */}
      <div className="px-3.5 pt-2.5">
        <div className="space-y-1.5" aria-hidden="true">
          <div className="h-[5px] w-full rounded-full bg-slate-200/80" />
          <div className="h-[5px] w-10/12 rounded-full bg-slate-200/80" />
          <div className="h-[5px] w-6/12 rounded-full bg-slate-200/80" />
        </div>
        <p className="mt-2.5 text-[0.625rem] text-slate-600 leading-snug">{persona.signoff}</p>
        <p className="text-[0.6875rem] font-bold text-slate-900 leading-snug">{first}</p>
        <div className="mt-2 rounded-lg overflow-hidden ring-1 ring-slate-200">
          <CardScaler>
            <Template data={persona.data} />
          </CardScaler>
        </div>
        <p className="mt-1.5 pb-3 text-[0.46875rem] text-slate-500 text-center">Swift Signature · tap to open card</p>
      </div>
    </div>
  );
}

// The live card page rendered at its natural phone width and scaled down as
// one unit — every class below is the real page's own. What fits (owner:
// "do what you could fit", no scrolling): the card, Save {first}'s contact,
// the Share-your-info form, and the Swift Links box (bio, website capsule,
// brand discs). The share-this-card section and CTA don't fit and are the
// page's least-identifying pieces.
const PHONE_NATURAL_W = 390;
const PHONE_NATURAL_H = 876;
const PHONE_SCALE = 0.66;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-900 font-bold text-[0.9375rem] tracking-tight">{children}</p>;
}

/** CENTER — the SwiftCard link, as a visitor opens it on their phone. */
function PhoneCard({ persona }: { persona: Persona }) {
  const { Template } = persona;
  const first = persona.data.name.split(" ")[0];
  const domain = persona.data.website || "";
  return (
    <div className="w-full h-full flex flex-col">
      {/* the page, natural width, scaled as one unit */}
      <div className="mx-auto overflow-hidden" style={{ width: PHONE_NATURAL_W * PHONE_SCALE, height: PHONE_NATURAL_H * PHONE_SCALE }}>
        <div className="origin-top-left flex flex-col items-center px-4 pt-2 pb-4 gap-4" style={{ width: PHONE_NATURAL_W, height: PHONE_NATURAL_H, transform: `scale(${PHONE_SCALE})` }}>

          {/* Business card */}
          <div className="w-full max-w-sm">
            <CardScaler>
              <Template data={persona.data} />
            </CardScaler>
          </div>

          {/* ── Save Contact — the page's primary action ── */}
          <div className="w-full max-w-sm rounded-2xl p-4 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
            <SectionHeading>Save {first}&apos;s contact</SectionHeading>
            <div className="mt-3 w-full text-white font-semibold py-3 px-4 rounded-full text-sm flex items-center justify-center gap-2 whitespace-nowrap" style={{ background: persona.accent }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Save Contact
            </div>
          </div>

          {/* ── Share Your Info Back ── */}
          <div className="w-full max-w-sm rounded-2xl p-4 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
            <SectionHeading>Share your info with {first}</SectionHeading>
            <div className="mt-3 space-y-2.5">
              <div className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400 shadow-sm">Your name *</div>
              <div className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400 shadow-sm">Your phone number *</div>
              <div className="w-full text-white font-semibold py-3 px-6 rounded-full text-sm text-center" style={{ background: persona.accent }}>
                Share My Info
              </div>
            </div>
          </div>

          {/* ── Swift Links — bio, website capsule, brand discs ── */}
          <div className="w-full max-w-sm rounded-2xl p-4 shadow-sm" style={{ background: "#fff", border: "1px solid #E4DDD4" }}>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <SectionHeading>Swift Links</SectionHeading>
              <span className="shrink-0 text-[0.6875rem] font-medium text-slate-500 rounded-full px-2.5 py-1 bg-[#FAF7F2]" style={{ boxShadow: "inset 0 0 0 1px #EFE9E1" }}>
                View Swift Link page →
              </span>
            </div>
            <p className="text-slate-600 text-[0.8125rem] leading-[1.6]">{persona.bio}</p>
            <div className="h-px bg-[#EFE9E1] my-3" />
            <div className="flex flex-col gap-2.5">
              <span className="inline-flex self-start items-center gap-2 max-w-full h-10 rounded-full pl-1.5 pr-3 bg-white" style={{ boxShadow: "inset 0 0 0 1px #E7E0D7, 0 1px 2px rgba(15,23,42,0.04)" }}>
                <span className="shrink-0 w-7 h-7 rounded-full bg-white grid place-items-center overflow-hidden text-[0.6875rem] font-bold text-slate-500" style={{ boxShadow: "inset 0 0 0 1px #EDE6DC" }}>
                  {domain.charAt(0).toUpperCase()}
                </span>
                <span className="truncate lowercase font-medium text-[0.78125rem] tracking-[-0.004em] text-[#334155]">{domain}</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {persona.socials.map((so) => (
                  <span
                    key={so.label}
                    className="relative w-10 h-10 rounded-full grid place-items-center text-white"
                    style={{
                      background: so.label === "Instagram" ? "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)" : so.color || "rgba(15,23,42,0.85)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 0 0 1px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.14)",
                    }}
                  >
                    <PlatformIcon label={so.label} className="w-[18px] h-[18px] shrink-0" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The three-panel stage for ONE persona — shared by the rotating homepage
 *  hero and the static per-industry showcase on /for/<industry>. */
function Stage({ persona, entered, preload }: { persona: Persona; entered: boolean; preload: Persona[] }) {
  return (
    <div className="relative w-[692px] h-[680px] select-none pointer-events-none" aria-label={`Example SwiftCard: ${persona.job}`}>
      {/* Every persona's photo/logo, loaded once up front — panels remount on
          each swap, and without this the hero flashes empty for the first
          cycle while the next image fetches. */}
      <div className="hidden" aria-hidden="true">
        {preload.flatMap((pp) => [pp.data.photoUrl, pp.data.logoUrl]).filter(Boolean).map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src!} alt="" />
        ))}
      </div>

      {/* job tag */}
      <div className="absolute top-0 left-[350px] -translate-x-1/2 z-40">
        <span
          key={persona.key + "-tag"}
          className={`sc-hs-fade inline-block rounded-full bg-white/90 backdrop-blur px-3.5 py-1 text-[0.6875rem] font-bold text-slate-700 shadow-sm border border-slate-200/70 ${entered ? "" : "sc-hs-hidden"}`}
        >
          {persona.job}
        </span>
      </div>

      {/* CENTER — the phone. Crossfades between personas (link.me's center).
          The shell is the shared PhoneFrame: real iPhone geometry, Dynamic
          Island, titanium rail, glass. 582 + the frame's own 17px of rail and
          bezel lands back on the 600px height this stage was laid out around,
          so nothing else on the stage moves. */}
      <div className="absolute left-[210px] top-[34px] z-20">
        <PhoneFrame
          width={280}
          // SQUARE TO THE PAGE. Owner's call, 2026-09-11: -1.6° → -0.8° →
          // straight. Depth on this stage is carried by four cues (scale,
          // angle, shadow, air — see the note below); the phone gives up the
          // angle and keeps the other three, and the flanking panels still sit
          // at -2.4° and +2.1°, so the group does not read as flat.
          //
          // 0 and not a tiny value: PhoneFrame treats a falsy tilt as "no
          // transform at all" rather than rotate(0deg), so the phone is not
          // promoted to its own compositor layer for a rotation of nothing.
          tilt={0}
          screenStyle={{ height: 582, background: phoneScreenWash(persona.accent) }}
          ariaLabel="A SwiftCard link open on a phone"
        >
          <div key={persona.key + "-phone"} className={`sc-hs-fade w-full h-full ${entered ? "" : "sc-hs-hidden"}`}>
            <PhoneCard persona={persona} />
          </div>
        </PhoneFrame>
      </div>

      {/* THE THREE OBJECTS SIT AT THREE DEPTHS.
          Before this they did not: same shadow, same scale, same dead-flat
          angle on all three, which is why a phone and two panels read as three
          stickers laid on the page instead of a photograph of a desk.
          Depth here is carried by four cues at once, all of them small:
            • SCALE     — the far panel is 94.5%, the near one full size.
            • ANGLE     — a couple of degrees each way. Nothing in a real
                          photograph is perfectly square to the lens.
            • SHADOW    — far = wide, soft and weak; near = tighter and darker;
                          the phone (PhoneFrame) darkest of all. Distance is
                          mostly read from how hard a shadow is.
            • AIR       — the far panel loses a little saturation and contrast,
                          which is what distance does to colour. Deliberately
                          NOT blur: the owner's standing order is that every
                          panel stays legible, and a blurred one does not.
          The static depth transform has to live on its own element because the
          drift keyframes animate `transform` — one element cannot hold both. */}

      {/* LEFT flanker — the full Swift Links page, furthest back. IN FRONT of
          the phone's edge (owner: nothing may hide under the phone).
          It now sits in a REAL phone (owner, 2026-09-17: "make these look way
          more realistic") — a Swift Links page is something you open on a
          phone, and a second device reads as a desk instead of a floating
          slab. 213px body ≈ the 198px page width this panel is drawn at. */}
      <div
        className="absolute left-0 top-[96px] z-10"
        // 0.9, not 0.945: the page is in a phone body now (213px wide), and at
        // 0.945 its right edge slipped under the centre phone — the owner’s
        // standing rule is that nothing hides under it. Smaller also reads as
        // further away, which is the point of this panel.
        style={{ transform: "rotate(-2.4deg) scale(0.9)", transformOrigin: "left center", filter: "saturate(0.94) contrast(0.975)" }}
      >
        {/* The shadow the device casts on the surface it rests on. */}
        <span className="sc-hs-ground" style={{ left: "6%", right: "6%", bottom: -14, height: 26 }} aria-hidden="true" />
        <div className="sc-hs-drift">
          <PhoneFrame
            width={213}
            tilt={0}
            statusBar="overlay"
            statusTone={persona.look.mode === "light" ? "dark" : "light"}
            indicatorTone={persona.look.mode === "light" ? "dark" : "light"}
            screenStyle={{ height: LINKS_H, background: persona.look.sheet }}
            ariaLabel="A Swift Links page open on a phone"
          >
            <div key={persona.key + "-links"} className={`sc-hs-slide-l ${entered ? "" : "sc-hs-hidden-l"}`}>
              <MiniLinks persona={persona} />
            </div>
          </PhoneFrame>
        </div>
      </div>

      {/* RIGHT flanker — Swift Signature, nearest the viewer, sits low. */}
      <div
        className="absolute right-0 bottom-[70px] z-10"
        style={{ transform: "rotate(2.1deg)", transformOrigin: "right center" }}
      >
        <span className="sc-hs-ground" style={{ left: "8%", right: "8%", bottom: -12, height: 22 }} aria-hidden="true" />
        <div className="rounded-[18px] shadow-[0_18px_38px_-12px_rgba(8,10,18,0.5),0_3px_8px_-2px_rgba(8,10,18,0.32)] ring-1 ring-black/5 sc-hs-drift" style={{ animationDelay: "1.4s", animationDuration: "5.1s" }}>
          <div key={persona.key + "-sig"} className={`sc-hs-slide-r ${entered ? "" : "sc-hs-hidden-r"}`}>
            <MiniSignature persona={persona} />
          </div>
        </div>
      </div>

      <style>{`
        /* The hand-off between people. The three objects do not move as one
           block: the far phone leads, the near signature follows a beat later,
           and each drifts a little as it fades, the way a rack focus moves
           between things at different distances. */
        .sc-hs-fade { transition: opacity 0.42s ease, transform 0.42s cubic-bezier(0.25,1,0.5,1); opacity: 1; transform: scale(1); transition-delay: 0.06s; }
        .sc-hs-hidden { opacity: 0; transform: scale(0.985); transition-delay: 0s; }
        .sc-hs-slide-l { transition: opacity 0.46s ease, transform 0.46s cubic-bezier(0.25,1,0.5,1); opacity: 1; transform: translate3d(0,0,0) scale(1); }
        .sc-hs-hidden-l { opacity: 0; transform: translate3d(-26px,8px,0) scale(0.97); }
        .sc-hs-slide-r { transition: opacity 0.46s ease 0.12s, transform 0.46s cubic-bezier(0.25,1,0.5,1) 0.12s; opacity: 1; transform: translate3d(0,0,0) scale(1); }
        .sc-hs-hidden-r { opacity: 0; transform: translate3d(26px,10px,0) scale(0.97); transition-delay: 0s; }
        /* Contact shadow: what a device resting on a surface actually casts. */
        .sc-hs-ground { position: absolute; z-index: -1; border-radius: 9999px; pointer-events: none;
          background: radial-gradient(60% 50% at 50% 50%, rgba(8,10,18,0.30), rgba(8,10,18,0) 72%); filter: blur(6px); }
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

  return <Stage persona={PERSONAS[idx]} entered={entered} preload={PERSONAS} />;
}

/** One persona, standing still — the /for/<industry> hero. `scale` draws the
 *  692×680 stage smaller while keeping its layout box the scaled size. */
export function PersonaShowcase({ personaKey, scale = 1 }: { personaKey: string; scale?: number }) {
  const persona = ALL_PERSONAS.find((pp) => pp.key === personaKey);
  if (!persona) return null;
  return (
    <div style={{ width: Math.round(692 * scale), height: Math.round(680 * scale) }}>
      <div className="origin-top-left" style={{ transform: `scale(${scale})` }}>
        <Stage persona={persona} entered preload={[persona]} />
      </div>
    </div>
  );
}
