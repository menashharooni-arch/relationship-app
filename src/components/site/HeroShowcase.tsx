"use client";

import { useEffect, useRef, useState } from "react";
import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import LogoFirst from "@/components/card-templates/LogoFirst";
import type { CardData } from "@/components/card-templates/types";
import { getLook, type SwiftLinkLook } from "@/lib/swiftlink-looks";

// ── The hero's rotating persona showcase (owner order 2026-08-26, modeled on
//    link.me's front page) ────────────────────────────────────────────────────
//
// link.me's hero rotates real creators: a tall phone showing the profile in
// the CENTER, flanked by two half-size cards that slide in from outside —
// upper-LEFT and lower-RIGHT — with a fade, then drift gently while visible
// (geometry + timing measured off their live page: ±32px entrance, ~4.5s per
// persona, crossfading center).
//
// Ours rotates six fake professionals — realtor, electrician, insurance
// agent, banker, lawyer, car salesperson — each on a DIFFERENT one of the six
// real card templates with its own accent palette:
//   CENTER  — the SwiftCard link as a visitor opens it (real template render
//             inside a phone, on the card page's cream wash, with the Save
//             Contact bar),
//   LEFT    — that persona's Swift Links page (a real Look from the library),
//   RIGHT   — their Swift Signature (the sign-off + the same card as the
//             email image — the signature IS the card, so it re-renders the
//             identical template small).
//
// Display-only: pointer-events are dead across the whole stage; nothing here
// downloads, posts, or navigates. Respects prefers-reduced-motion (no timer,
// first persona static).

type Persona = {
  key: string;
  job: string;
  Template: React.ComponentType<{ data: CardData }>;
  data: CardData;
  look: SwiftLinkLook;
  handle: string;
  /** Two Swift Links tiles: [emoji, label] each, colored off the look. */
  tiles: Array<[string, string]>;
  tileGrad: string;
  signoff: string;
};

const p = (partial: Omit<CardData, "initials"> & { initials?: string }): CardData => ({
  initials: partial.name.split(" ").map((n) => n[0]).join("").slice(0, 2),
  photoUrl: null,
  logoUrl: null,
  ...partial,
});

const PERSONAS: Persona[] = [
  {
    key: "realtor", job: "Realtor", Template: PhotoFirst, handle: "@mayasellshomes",
    data: p({
      name: "Maya Castillo", title: "Realtor®", company: "Harbor & Vine Realty",
      phone: "(415) 555-0132", email: "maya@harborvine.com", website: "harborvine.com",
      cardUrl: "swiftcard.me/mayacastillo",
      customization: { accentColor: "#7C3AED" },
    }),
    look: getLook("nebula"),
    tiles: [["🏡", "Current listings"], ["📅", "Book a viewing"]],
    tileGrad: "linear-gradient(135deg, #7c3aed 0%, #4338ca 60%, #1d4ed8 100%)",
    signoff: "Talk soon,",
  },
  {
    key: "electrician", job: "Electrician", Template: LocalBusiness, handle: "@delgadoelectric",
    data: p({
      name: "Ray Delgado", title: "Master Electrician", company: "Delgado Electric",
      phone: "(512) 555-0177", email: "ray@delgadoelectric.com", website: "delgadoelectric.com",
      cardUrl: "swiftcard.me/raydelgado",
    }),
    look: getLook("sand"),
    tiles: [["⚡", "Request a quote"], ["⭐", "Read reviews"]],
    tileGrad: "linear-gradient(135deg, #d97706 0%, #b45309 60%, #92400e 100%)",
    signoff: "Thanks,",
  },
  {
    key: "insurance", job: "Insurance agent", Template: ClassicPro, handle: "@danawhitfield",
    data: p({
      name: "Dana Whitfield", title: "Insurance Advisor", company: "Beacon Mutual",
      phone: "(303) 555-0149", email: "dana@beaconmutual.com", website: "beaconmutual.com",
      cardUrl: "swiftcard.me/danawhitfield",
    }),
    look: getLook("paper"),
    tiles: [["🛡️", "Free coverage review"], ["📄", "Start a claim"]],
    tileGrad: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 60%, #172554 100%)",
    signoff: "Best regards,",
  },
  {
    key: "banker", job: "Private banker", Template: LuxuryMinimal, handle: "@prestoncole",
    data: p({
      name: "Preston Cole", title: "Private Banker", company: "Meridian Private Bank",
      phone: "(212) 555-0186", email: "pcole@meridianpb.com", website: "meridianpb.com",
      cardUrl: "swiftcard.me/prestoncole",
    }),
    look: getLook("chrome"),
    tiles: [["🗓️", "Schedule a consultation"], ["📈", "Market briefing"]],
    tileGrad: "linear-gradient(135deg, #b08d57 0%, #8c6d3f 60%, #5c4726 100%)",
    signoff: "Kind regards,",
  },
  {
    key: "lawyer", job: "Attorney", Template: ModernBold, handle: "@adlergrant",
    data: p({
      name: "Simone Adler", title: "Managing Partner", company: "Adler & Grant LLP",
      phone: "(646) 555-0121", email: "sadler@adlergrant.law", website: "adlergrant.law",
      cardUrl: "swiftcard.me/simoneadler",
    }),
    look: getLook("midnight"),
    tiles: [["⚖️", "Case consultation"], ["🏛️", "Practice areas"]],
    tileGrad: "linear-gradient(135deg, #334155 0%, #1e293b 60%, #0f172a 100%)",
    signoff: "Sincerely,",
  },
  {
    key: "cars", job: "Car salesperson", Template: LogoFirst, handle: "@tonymarchetti",
    data: p({
      name: "Tony Marchetti", title: "Sales Manager", company: "Marchetti Motors",
      phone: "(702) 555-0166", email: "tony@marchettimotors.com", website: "marchettimotors.com",
      cardUrl: "swiftcard.me/tonymarchetti",
      customization: { accentColor: "#DC2626" },
    }),
    look: getLook("onyx"),
    tiles: [["🚗", "Browse inventory"], ["🔑", "Book a test drive"]],
    tileGrad: "linear-gradient(135deg, #dc2626 0%, #991b1b 60%, #450a0a 100%)",
    signoff: "Drive safe,",
  },
];

const ROTATE_MS = 4500;

/** Initials avatar — same monogram everywhere so the three panels read as one person. */
function Monogram({ persona, size, ring }: { persona: Persona; size: number; ring?: string }) {
  return (
    <span
      className="rounded-full grid place-items-center font-black text-white shrink-0"
      style={{ width: size, height: size, background: persona.tileGrad, fontSize: size * 0.36, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }}
    >
      {persona.data.initials}
    </span>
  );
}

/** LEFT — a miniature of the persona's Swift Links page in a real Look. */
function MiniLinks({ persona }: { persona: Persona }) {
  const L = persona.look;
  const dark = L.mode === "dark";
  const text = dark ? "#fff" : "#0f172a";
  const sub = dark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.55)";
  const tileBg = dark ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.05)";
  return (
    <div
      className="w-full h-full rounded-[18px] overflow-hidden flex flex-col items-center px-3 pt-4"
      style={{ background: L.sheetTo ? `linear-gradient(180deg, ${L.sheet}, ${L.sheetTo})` : L.sheet }}
    >
      <Monogram persona={persona} size={40} ring={dark ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.12)"} />
      <p className="mt-1.5 text-[11px] font-bold leading-tight text-center" style={{ color: text }}>{persona.data.name}</p>
      <p className="text-[8.5px]" style={{ color: sub }}>{persona.handle}</p>
      <div className="mt-1.5 flex items-center gap-1" aria-hidden="true">
        {["#0A66C2", "#E1306C", "#010101"].map((c) => (
          <span key={c} className="w-[13px] h-[13px] rounded-full border border-white/40" style={{ background: c }} />
        ))}
      </div>
      <div className="mt-2 w-full space-y-1.5">
        {persona.tiles.map(([emoji, label]) => (
          <div key={label} className="w-full rounded-[9px] px-2 py-1.5 flex items-center gap-1.5" style={{ background: tileBg }}>
            <span className="text-[10px] leading-none">{emoji}</span>
            <span className="text-[8.5px] font-semibold truncate" style={{ color: text }}>{label}</span>
          </div>
        ))}
        <div className="w-full rounded-[9px] aspect-[2.6/1] relative overflow-hidden" style={{ background: persona.tileGrad }}>
          <span className="absolute inset-x-0 bottom-1 text-center text-white text-[8px] font-bold" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
            Featured
          </span>
        </div>
      </div>
    </div>
  );
}

/** RIGHT — a miniature of the persona's Swift Signature: the sign-off + the same card as the email image. */
function MiniSignature({ persona }: { persona: Persona }) {
  const { Template } = persona;
  return (
    <div className="w-full h-full rounded-[18px] overflow-hidden bg-white flex flex-col px-3 pt-3">
      <div className="space-y-1" aria-hidden="true">
        <div className="h-[5px] w-10/12 rounded-full bg-slate-200/80" />
        <div className="h-[5px] w-7/12 rounded-full bg-slate-200/80" />
      </div>
      <p className="mt-2 text-[9px] text-slate-600 leading-snug">{persona.signoff}</p>
      <p className="text-[10px] font-bold text-slate-900 leading-snug">{persona.data.name.split(" ")[0]}</p>
      <div className="mt-1.5 rounded-lg overflow-hidden ring-1 ring-slate-200">
        <CardScaler>
          <Template data={persona.data} />
        </CardScaler>
      </div>
      <p className="mt-1 text-[7px] text-slate-400 text-center">Swift Signature · tap to open card</p>
    </div>
  );
}

/** CENTER — the SwiftCard link, as a visitor opens it on their phone. */
function PhoneCard({ persona }: { persona: Persona }) {
  const { Template } = persona;
  return (
    <div
      className="w-full h-full rounded-[30px] overflow-hidden flex flex-col"
      style={{ background: "#FAF7F2" }}
    >
      {/* status strip */}
      <div className="flex items-center justify-between px-5 pt-2.5 pb-1" aria-hidden="true">
        <span className="text-[9px] font-semibold text-slate-700">9:41</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-[7px] rounded-[2px] border border-slate-500/70 relative"><span className="absolute inset-[1px] right-[3px] bg-slate-600 rounded-[1px]" /></span>
        </span>
      </div>
      <div className="px-2.5">
        <CardScaler>
          <Template data={persona.data} />
        </CardScaler>
      </div>
      <div className="px-4 mt-2.5 space-y-1.5">
        <div className="flex items-center justify-center gap-1.5 rounded-full py-2 text-white text-[11px] font-bold" style={{ background: "var(--sc-accent, #1D4ED8)" }}>
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0" /></svg>
          Save Contact
        </div>
        <div className="flex items-center justify-center rounded-full py-2 text-[11px] font-semibold" style={{ background: "#fff", border: "1px solid #E4DDD4", color: "#475569" }}>
          Share your info
        </div>
      </div>
      <p className="mt-auto pb-2.5 text-center text-[8px] text-slate-400">swiftcard.me/{persona.data.name.toLowerCase().replace(/[^a-z]/g, "")}</p>
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
    <div className="relative w-[560px] h-[620px] select-none pointer-events-none" aria-label={`Example SwiftCard: ${persona.job}`}>
      {/* job tag */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-30">
        <span
          key={persona.key + "-tag"}
          className={`sc-hs-fade inline-block rounded-full bg-white/90 backdrop-blur px-3.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm border border-slate-200/70 ${entered ? "" : "sc-hs-hidden"}`}
        >
          {persona.job}
        </span>
      </div>

      {/* CENTER — the phone. Crossfades between personas (link.me's center). */}
      <div className="absolute left-1/2 top-7 -translate-x-1/2 z-20 w-[292px] h-[560px] rounded-[38px] bg-slate-900 p-[7px] shadow-[0_40px_90px_-30px_rgba(8,10,18,0.6)]">
        <div key={persona.key + "-phone"} className={`sc-hs-fade w-full h-full ${entered ? "" : "sc-hs-hidden"}`}>
          <PhoneCard persona={persona} />
        </div>
      </div>

      {/* LEFT flanker — Swift Links, slides in from the left, sits high. */}
      <div className="absolute left-0 top-[84px] z-10 w-[152px] h-[212px] rounded-[20px] shadow-[0_24px_50px_-18px_rgba(8,10,18,0.5)] ring-1 ring-black/5 sc-hs-drift">
        <div key={persona.key + "-links"} className={`sc-hs-slide-l w-full h-full ${entered ? "" : "sc-hs-hidden-l"}`}>
          <MiniLinks persona={persona} />
        </div>
      </div>

      {/* RIGHT flanker — Swift Signature, slides in from the right, sits low. */}
      <div className="absolute right-0 bottom-[64px] z-30 w-[168px] h-[218px] rounded-[20px] shadow-[0_24px_50px_-18px_rgba(8,10,18,0.5)] ring-1 ring-black/5 sc-hs-drift" style={{ animationDelay: "1.4s" }}>
        <div key={persona.key + "-sig"} className={`sc-hs-slide-r w-full h-full ${entered ? "" : "sc-hs-hidden-r"}`}>
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
        @media (prefers-reduced-motion: reduce) {
          .sc-hs-fade, .sc-hs-slide-l, .sc-hs-slide-r { transition: none; }
          .sc-hs-drift { animation: none; }
        }
      `}</style>
    </div>
  );
}
