"use client";

import { useState, useEffect } from "react";
import DashboardLink from "@/components/DashboardLink";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import { SAMPLE_DATA, withoutSocials } from "@/components/card-templates/types";

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
] as const;

export default function TemplatesPage() {
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

  async function handleApply() {
    if (!selected) return;
    localStorage.setItem("kontact_template", selected);
    setSaved(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: selected }),
    });
    setTimeout(() => setSaved(false), 2000);
  }

  const selectedTemplate = TEMPLATES.find((t) => t.id === selected);

  return (
    <main className="min-h-screen bg-gray-950 pb-28">

      {/* Header */}
      <div className="px-5 pt-10 pb-8 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <DashboardLink className="text-gray-500 hover:text-white text-sm transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Dashboard
          </DashboardLink>
          <SwiftCardLogo size={28} onDark />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Your card, your way.</h1>
        <p className="text-gray-400">
          Choose the design that fits your business. You can change it anytime.
        </p>
      </div>

      {/* Template list */}
      <div className="max-w-2xl mx-auto px-5 space-y-10">
        {TEMPLATES.map((tmpl, i) => {
          const { Component } = tmpl;
          const isSelected = selected === tmpl.id;

          return (
            <div key={tmpl.id}>
              {/* Template label */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                  style={{
                    background: isSelected ? "#2563eb" : "#1f2937",
                    color: isSelected ? "#fff" : "#6b7280",
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <span className="text-white font-semibold text-sm">{tmpl.name}</span>
                  <span className="text-gray-500 text-sm ml-2">— {tmpl.tagline}</span>
                </div>
              </div>

              {/* Card preview — clicking selects it */}
              <button
                className="w-full text-left group outline-none"
                onClick={() => handleSelect(tmpl.id)}
                aria-pressed={isSelected}
              >
                <div
                  className="rounded-2xl transition-all duration-200"
                  style={{
                    outline: isSelected ? "3px solid #3b82f6" : "2px solid transparent",
                    outlineOffset: 3,
                    boxShadow: isSelected ? "0 0 0 5px rgba(59,130,246,0.15)" : undefined,
                  }}
                >
                  <CardScaler>
                    <Component data={withoutSocials(SAMPLE_DATA)} />
                  </CardScaler>
                </div>
              </button>

              {/* Tags + select */}
              <div className="flex items-center justify-between mt-3 gap-4">
                <div className="flex flex-wrap gap-1.5">
                  {tmpl.bestFor.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "#111827", color: "#6b7280" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => handleSelect(tmpl.id)}
                  className="shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full transition-colors"
                  style={{
                    background: isSelected ? "#1d4ed8" : "#1f2937",
                    color: isSelected ? "#ffffff" : "#9ca3af",
                  }}
                >
                  {isSelected ? "✓ Selected" : "Select"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky bottom bar — appears when a template is selected */}
      {selected && (
        <div className="fixed bottom-0 left-0 right-0 px-5 py-4" style={{ background: "rgba(3,7,18,0.95)", backdropFilter: "blur(12px)", borderTop: "1px solid #1f2937" }}>
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{selectedTemplate?.name}</p>
              <p className="text-gray-500 text-xs">{selectedTemplate?.tagline}</p>
            </div>
            <button
              onClick={handleApply}
              className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-full text-sm transition-colors"
            >
              {saved ? "Saved ✓" : "Apply this design →"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
