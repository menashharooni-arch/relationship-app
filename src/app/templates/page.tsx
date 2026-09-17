"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import LogoFirst from "@/components/card-templates/LogoFirst";
import { SAMPLE_DATA_WITH_PHOTO, withoutSocials } from "@/components/card-templates/types";
import HomeHeadingReveal from "@/components/site/HomeHeadingReveal";
import "@/app/home.css";

const TEMPLATES = [
  {
    id: "classic-pro",
    name: "Classic Professional",
    tagline: "Clean, trustworthy, and timeless.",
    bestFor: ["Consulting", "Law", "Finance", "Real Estate"],
    Component: ClassicPro,
  },
  {
    id: "modern-bold",
    name: "Modern Bold",
    tagline: "High contrast, strong presence.",
    bestFor: ["Tech", "Architecture", "Design", "Finance"],
    Component: ModernBold,
  },
  {
    id: "photo-first",
    name: "Photo First",
    tagline: "Personal and approachable. Face-forward.",
    bestFor: ["Coaching", "Real Estate", "Sales", "Personal Brand"],
    Component: PhotoFirst,
  },
  {
    id: "local-business",
    name: "Local Business",
    tagline: "Easy to scan. Built for trades and services.",
    bestFor: ["Contractors", "Barbers", "Nail Techs", "Restaurants"],
    Component: LocalBusiness,
  },
  {
    id: "luxury-minimal",
    name: "Luxury Minimal",
    tagline: "Refined and elegant. Every detail considered.",
    bestFor: ["Luxury Real Estate", "Interior Design", "Jewelry", "Spa"],
    Component: LuxuryMinimal,
  },
  {
    id: "logo-first",
    name: "Logo First",
    tagline: "Leads with your mark, not your face.",
    bestFor: ["Agencies", "Firms", "Contractors", "Funds"],
    Component: LogoFirst,
    // Its own data, rather than adding a logo to the shared sample: Classic Pro
    // and Local Business both render a logo too, so putting one on the shared
    // object would silently redesign the five cards already on this page.
    data: { ...withoutSocials(SAMPLE_DATA_WITH_PHOTO), logoUrl: "/marketing/demo-logo.svg" },
  },
] as const;

export default function TemplatesPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("kontact_template");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read from localStorage
    if (stored) setSelected(stored);
  }, []);

  function handleSelect(id: string) {
    setSelected(id);
    setSaved(false);
  }

  // "Apply this design" starts the real card builder on this template —
  // the same destination as every "Create your free card" button. It used to
  // PATCH /api/profile, which silently did nothing for the signed-out visitors
  // who now reach this page, and gave signed-in ones no next step either.
  function handleApply() {
    if (!selected) return;
    localStorage.setItem("kontact_template", selected);
    setSaved(true);
    router.push(`/cards/new?template=${encodeURIComponent(selected)}`);
  }

  const selectedTemplate = TEMPLATES.find((t) => t.id === selected);

  return (
    // Light page (owner, 2026-09-17: "take away the dark backgrounds"). The
    // card previews keep their own look; only the page around them is light.
    // hp-soft on main so the pb-28 that clears the sticky bar matches the footer.
    <main className="hp hp-soft min-h-screen pb-28">
      {/* The standard site header, so this page can be navigated away from
          anywhere — it replaced a lone history-back button, which was a dead
          end for anyone arriving from a link or the footer. */}
      <SiteNav />
      <HomeHeadingReveal />

      <section className="hp-page-hero">
        <div className="relative px-5 pt-28 sm:pt-36 pb-10 sm:pb-14 max-w-2xl mx-auto" data-hp-head>
          <h1 className="rd-display text-slate-900 text-[clamp(2.2rem,5vw,3.4rem)]">Your card, <span className="hp-fill">your way.</span></h1>
          <p className="hp-lede mt-4">
            Choose the design that fits your business. You can change it anytime.
          </p>
        </div>
      </section>

      {/* Template list */}
      <section className="hp-soft pt-12 sm:pt-16 pb-16">
      <div className="max-w-2xl mx-auto px-5 space-y-12">
        {TEMPLATES.map((tmpl, i) => {
          const { Component } = tmpl;
          const isSelected = selected === tmpl.id;

          return (
            <div key={tmpl.id}>
              {/* Template label */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: isSelected ? "var(--rd-aurora)" : "#fff",
                    color: isSelected ? "#fff" : "#64748b",
                    boxShadow: isSelected ? undefined : "inset 0 0 0 1px rgba(11,16,34,0.12)",
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <span className="text-slate-900 font-semibold text-[0.9375rem]">{tmpl.name}</span>
                  <span className="text-slate-500 text-sm ml-2">— {tmpl.tagline}</span>
                </div>
              </div>

              {/* Card preview — clicking selects it */}
              <button
                className="w-full text-left group outline-none"
                onClick={() => handleSelect(tmpl.id)}
                aria-pressed={isSelected}
                // Same reason as site/TemplateGallery: the preview is a real
                // card with real contact links, so it must not be a nest of
                // controls inside this one. One button, one name.
                aria-label={`Choose the ${tmpl.name} template`}
              >
                <div
                  // inert, not aria-hidden: the preview holds real tel:/mailto:
                  // links, and aria-hidden over focusable content is its own
                  // violation. inert takes them out of BOTH the a11y tree and
                  // the tab order, which is what "this is a picture of a card"
                  // actually means.
                  inert
                  className="rounded-2xl transition-all duration-200"
                  style={{
                    outline: isSelected ? "3px solid #3b82f6" : "2px solid transparent",
                    outlineOffset: 3,
                    boxShadow: isSelected ? "0 0 0 5px rgba(59,130,246,0.15)" : undefined,
                    // The card's phone/email/website are real tel:/mailto:/https:
                    // links. Sitting inside the selector button they swallowed the
                    // click: tapping a card on its contact rows opened a mail client
                    // instead of choosing that template, and the targets here are the
                    // biggest on the site (~218px). Letting pointer events pass
                    // through makes the whole card select, which is what it looks
                    // like it should do. Same as TemplateGallery's grid tiles.
                    pointerEvents: "none",
                  }}
                >
                  <CardScaler>
                    <Component data={"data" in tmpl ? tmpl.data : withoutSocials(SAMPLE_DATA_WITH_PHOTO)} />
                  </CardScaler>
                </div>
              </button>

              {/* Tags + select */}
              <div className="flex items-center justify-between mt-3 gap-4">
                <div className="flex flex-wrap gap-1.5">
                  {tmpl.bestFor.map((tag) => (
                    <span
                      key={tag}
                      className="text-[0.6875rem] font-medium px-2.5 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => handleSelect(tmpl.id)}
                  className="shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full transition-colors"
                  style={{
                    background: isSelected ? "#1d4ed8" : "#ffffff",
                    color: isSelected ? "#ffffff" : "#334155",
                    boxShadow: isSelected ? undefined : "inset 0 0 0 1px #cbd5e1",
                  }}
                >
                  {isSelected ? "✓ Selected" : "Select"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      </section>

      {/* Sticky bottom bar — appears when a template is selected */}
      {/* paddingBottom clears the iPhone home indicator — a flat py-4 left the
          Apply button sitting partly under it on notched devices. Same
          safe-area handling MobileNav and the preview CTA already use. */}
      {selected && (
        <div
          className="fixed bottom-0 left-0 right-0 px-5 pt-4"
          style={{
            background: "rgba(255,255,255,0.94)",
            backdropFilter: "blur(12px)",
            borderTop: "1px solid rgba(11,16,34,0.08)",
            boxShadow: "0 -12px 30px -18px rgba(11,16,34,0.25)",
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          }}
        >
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-slate-900 font-semibold text-sm truncate">{selectedTemplate?.name}</p>
              <p className="text-slate-500 text-xs">{selectedTemplate?.tagline}</p>
            </div>
            <button
              onClick={handleApply}
              className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-full text-sm transition-colors"
            >
              {saved ? "Opening builder…" : "Apply this design →"}
            </button>
          </div>
        </div>
      )}

      {/* Footer too, so the page has the same way out as every other page. */}
      <SiteFooter />
    </main>
  );
}
