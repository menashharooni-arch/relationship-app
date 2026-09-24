"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import CardScaler from "@/components/CardScaler";
import NativeHidden from "@/components/NativeHidden";
import Eyebrow from "@/components/site/Eyebrow";
import { FreeCard } from "@/components/card-templates/CustomCard";
import {
  DEMO_HEADSHOT, SAMPLE_DATA_WITH_PHOTO, withoutSocials,
  type AiDesignBrief, type CardData, type CustomLayout,
} from "@/components/card-templates/types";
import { AI_THEMES, buildDesign, fallbackSpec, type AiTheme, type DesignContext } from "@/lib/ai-card-design";
import "@/app/home.css";

// ── The AI Card Designer, shown on /templates ────────────────────────────────
//
// Every card here is a REAL design: the same pure engine the product runs
// (lib/ai-card-design: fallbackSpec → buildDesign) drawn by the same renderer
// (FreeCard). Nothing is fetched and no model is called — the marketing page
// shows exactly what the designer produces for a theme and two colours, with
// the site's demo persona on it.
//
// Two capabilities, two panels:
//   • Create with AI — a brief (headshot, logo, colours, theme) and the card
//     it becomes; three briefs cycle so the range is visible without a click.
//   • Recreate a design — a card someone ELSE owns, "uploaded", and the same
//     design carrying the demo persona's details. Same layout object, two
//     data sets: that is literally what the feature does.
//
// The feature itself is Pro and lives in Edit card → Card design → Custom
// design, which Get Started cannot reach — so the CTA is the free builder and
// the Pro note links to pricing (hidden in the iOS shell, which never sells).

const DEMO_LOGO = "/marketing/demo-logo.svg";
const DEMO: CardData = { ...withoutSocials(SAMPLE_DATA_WITH_PHOTO), logoUrl: DEMO_LOGO };

function contextFor(d: CardData): DesignContext {
  return {
    name: d.name, title: d.title, company: d.company, phone: d.phone, email: d.email,
    website: d.website ?? "", address: d.address ?? "",
    hasPhoto: !!d.photoUrl, hasLogo: !!d.logoUrl,
  };
}

function design(theme: AiTheme, colors: string[], ctx: DesignContext, opts: { headshot: boolean; logo: boolean; variant?: number }): CustomLayout {
  const brief: AiDesignBrief = { theme, colors, headshot: opts.headshot, logo: opts.logo, variant: opts.variant ?? 0 };
  return buildDesign(fallbackSpec(brief), ctx, brief);
}

// ── Create with AI: three briefs, three finished cards ──────────────────────

// Variants chosen from a contact sheet of every theme × variant (2026-09-24):
// the three cleanest compositions the engine makes with a photo AND a logo on.
const BRIEFS: { theme: AiTheme; colors: [string, string]; variant?: number }[] = [
  { theme: "modern", colors: ["#1e3a8a", "#4da8f5"], variant: 3 },  // photo-right
  { theme: "luxury", colors: ["#0c0a09", "#c9a96e"], variant: 1 },  // centered
  { theme: "creative", colors: ["#7c3aed", "#ec4899"], variant: 0 }, // orb-corner
];
const DESIGNS = BRIEFS.map((b) => ({
  ...b,
  label: AI_THEMES.find((t) => t.key === b.theme)?.label ?? b.theme,
  layout: design(b.theme, b.colors, contextFor(DEMO), { headshot: true, logo: true, variant: b.variant }),
}));
const CYCLE_MS = 4500;

// ── Recreate a design: a stranger's card, then the same design as yours ─────
//
// Deliberately NOT the demo persona: this card is the one the visitor
// "uploaded", so it has to belong to someone else for the point to land.
const STRANGER: CardData = {
  ...DEMO,
  name: "Jordan Ellis",
  title: "Principal Architect",
  company: "Ellis & Rowe",
  phone: "(212) 555-0142",
  email: "jordan@ellisrowe.com",
  website: "ellisrowe.com",
  address: "",
  initials: "JE",
  photoUrl: null,
  logoUrl: null,
  cardUrl: "swiftcard.me/jordanellis",
};
// Classic on purpose: a cream-and-navy card, so the "uploaded" design is not
// mistaken for one of the three dark AI designs in the other panel.
const RECREATED = design("classic", [], contextFor(STRANGER), { headshot: false, logo: false, variant: 2 });

// ── Small pieces ────────────────────────────────────────────────────────────

function Ico({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Sparkle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
    </svg>
  );
}

/** A card as a picture: inert, no pointer events (the demo persona's links must never be live). */
function Still({ data, layout, className = "" }: { data: CardData; layout: CustomLayout; className?: string }) {
  return (
    <div inert className={className} style={{ pointerEvents: "none" }}>
      <CardScaler>
        <FreeCard data={data} layout={layout} />
      </CardScaler>
    </div>
  );
}

function PanelHead({ icon, title, blurb }: { icon: string; title: string; blurb: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="hp-ai-ico" aria-hidden="true"><Ico d={icon} /></span>
      <div className="min-w-0">
        <h3 className="text-slate-900 font-semibold text-[1.125rem] leading-tight">{title}</h3>
        <p className="text-slate-500 text-[0.9375rem] mt-1 leading-relaxed">{blurb}</p>
      </div>
    </div>
  );
}

// ── Panel A ─────────────────────────────────────────────────────────────────

function CreatePanel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [live, setLive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cycle only while the panel is on screen, the tab is visible, motion is
  // welcome, and the visitor hasn't picked a design themselves.
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) { setLive(true); return; }
    const io = new IntersectionObserver((entries) => setLive(entries.some((e) => e.isIntersecting)), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!live || paused) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setIdx((i) => (i + 1) % DESIGNS.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [live, paused]);

  const active = DESIGNS[idx];

  return (
    <div className="hp-ai-panel" data-reveal>
      <div className="hp-ai-panel-in">
        <PanelHead
          icon="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4zM5 17l.9 2.1L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-.9zM19 15l.7 1.6 1.6.7-1.6.7L19 19.6l-.7-1.6-1.6-.7 1.6-.7z"
          title="Create with AI"
          blurb="Your headshot, logo, colors and a style. AI does the rest."
        />

        <div ref={ref} className="flex-1 flex flex-col mt-6">
          {/* The brief: what the owner gives it, as one quiet row. */}
          <div className="hp-ai-brief" aria-label="What you give it">
            <span className="hp-ai-brief-item">
              <span className="flex -space-x-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={DEMO_HEADSHOT} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-white" />
                {/* The demo mark is white (it ships on Logo First's navy), so it sits on a navy plate here too. */}
                <span className="w-7 h-7 rounded-full grid place-items-center overflow-hidden ring-2 ring-white" style={{ background: "#1e3a8a" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={DEMO_LOGO} alt="" className="w-4 h-4 object-contain" />
                </span>
              </span>
              Headshot &amp; logo
            </span>
            <span className="hp-ai-brief-item">
              <span className="flex -space-x-1">
                {active.colors.map((c, i) => (
                  <span key={i} className="hp-ai-swatch" style={{ background: c }} />
                ))}
              </span>
              Colors
            </span>
            <span className="hp-ai-brief-item">
              <span className="hp-ai-chip">{active.label}</span>
              Style
            </span>
            <span className="hp-ai-generate" aria-hidden="true">
              <Sparkle className="w-3 h-3" /> Generate
            </span>
          </div>

          {/* The result: three real designs, one on top at a time. */}
          <div className="hp-ai-stage flex-1 flex flex-col justify-center mt-4">
            <div className="relative" style={{ aspectRatio: "460 / 263" }}>
              {DESIGNS.map((d, i) => (
                <div key={d.theme} className={`hp-ai-slide absolute inset-0 ${i === idx ? "is-on" : ""}`} aria-hidden={i !== idx}>
                  <Still data={DEMO} layout={d.layout} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2" role="group" aria-label="Example designs">
            {DESIGNS.map((d, i) => (
              <button
                key={d.theme}
                type="button"
                onClick={() => { setIdx(i); setPaused(true); }}
                aria-label={`${d.label} design`}
                aria-pressed={i === idx}
                className="hp-ai-dot"
                data-on={i === idx ? "" : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Panel B ─────────────────────────────────────────────────────────────────

function RecreatePanel() {
  return (
    <div className="hp-ai-panel" data-reveal style={{ transitionDelay: "90ms" }}>
      <div className="hp-ai-panel-in">
        <PanelHead
          icon="M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M7 9h10M7 12h6M7 15h8"
          title="Recreate a design"
          blurb="Upload a card you like. AI rebuilds that look with your details."
        />

        <div className="hp-ai-stage flex-1 mt-6 flex flex-col items-center justify-center gap-3">
          {/* What they uploaded: someone else's card, as a photo. */}
          <div className="w-full max-w-[340px] px-2">
            <div className="hp-ai-photo">
              <Still data={STRANGER} layout={RECREATED} />
              <span className="hp-ai-scan" aria-hidden="true" />
            </div>
          </div>

          <div className="flex items-center justify-center text-blue-600" aria-hidden="true">
            <span className="hp-ai-arrow">
              <Sparkle className="w-3 h-3 hp-ai-arrow-spark" />
              <Ico d="M12 5v14M6 13l6 6 6-6" className="w-5 h-5" />
            </span>
          </div>

          {/* The same design, now theirs. */}
          <div className="relative w-full max-w-[340px] px-2" data-reveal style={{ transitionDelay: "260ms" }}>
            <Still data={DEMO} layout={RECREATED} />
            <span className="hp-ai-file hp-ai-file-you" aria-hidden="true">
              <Sparkle className="w-3 h-3" /> Yours
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── The flow ────────────────────────────────────────────────────────────────

const STEPS = [
  { t: "Details or inspiration", d: "Headshot, logo, colors, style — or a card you like.", icon: "M4 5h16v14H4zM4 15l4-4 3 3 4-5 5 6M16 8h.01" },
  { t: "AI designs it", d: "A polished card in seconds.", icon: "M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4zM5 17l.9 2.1L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-.9z" },
  { t: "Customize", d: "Move, resize, restyle anything.", icon: "M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3zM13 7l3 3" },
  { t: "Publish", d: "Live at your link, ready to share.", icon: "M12 16V4m0 0l-4 4m4-4l4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" },
];

export default function AiDesignerShowcase() {
  return (
    <section className="hp-ai relative overflow-hidden bg-white py-16 sm:py-24" aria-labelledby="ai-designer-heading">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mx-auto text-center" data-hp-head>
          <Eyebrow dark={false}>AI Card Designer</Eyebrow>
          <h2 id="ai-designer-heading" className="rd-h2 text-[clamp(2.1rem,4.4vw,3.4rem)] text-slate-900 mt-4">
            Your card, <span className="hp-fill">designed by AI.</span>
          </h2>
          <p className="hp-lede mt-4">
            Give it your details or a design you love. Get a polished card in seconds, then make it yours.
          </p>
        </div>

        <div className="mt-12 sm:mt-16 grid lg:grid-cols-2 gap-5">
          <CreatePanel />
          <RecreatePanel />
        </div>

        {/* Four steps on one track — the homepage's "How it works" line and nodes. */}
        <div className="hp-track hp-track-4 hidden md:grid grid-cols-4 mt-16" aria-hidden="true">
          <div className="hp-track-line" />
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex justify-center"><span className="hp-node">{n}</span></div>
          ))}
        </div>
        <ol className="mt-8 md:mt-6 grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="hp-ai-step" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="flex items-center gap-2.5">
                <span className="hp-step-num md:hidden">{i + 1}</span>
                <span className="hp-feat-ico text-blue-600" aria-hidden="true"><Ico d={s.icon} /></span>
              </div>
              <p className="text-slate-900 font-semibold text-[1rem] mt-3.5">{s.t}</p>
              <p className="text-slate-500 text-[0.9rem] mt-1 leading-relaxed">{s.d}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4" data-reveal="fade">
          <Link href="/cards/new" className="rd-btn rd-btn-primary rd-btn-lg">Start free</Link>
          <NativeHidden>
            <p className="text-slate-500 text-[0.9rem]">
              AI Card Designer is included with Pro. <Link href="/pricing" className="text-slate-900 font-semibold underline underline-offset-4 decoration-slate-300 hover:decoration-slate-900">See pricing</Link>
            </p>
          </NativeHidden>
        </div>
      </div>
    </section>
  );
}
