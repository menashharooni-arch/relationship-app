"use client";

import { useState } from "react";
import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import { withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";

const TEMPLATE_MAP: Record<string, React.ComponentType<{ data: CardData }>> = {
  "classic-pro": ClassicPro, "modern-bold": ModernBold, "photo-first": PhotoFirst,
  "local-business": LocalBusiness, "luxury-minimal": LuxuryMinimal,
};

type Social = { label: string; href: string };
type DemoCard = {
  key: "sales" | "realestate";
  label: string;
  handle: string;
  template: string;
  accent: string;
  data: CardData;
  bio: string;
  socials: Social[];
  links: { emoji: string; label: string }[];
  traffic: { card: string; links: string };
  leads: { name: string; initial: string; source: string; color: string; status: "New Contact" | "Touch" | "Dissolved"; time: string }[];
};

const CARDS: DemoCard[] = [
  {
    key: "sales",
    label: "Sales Card",
    handle: "demo-sales",
    template: "modern-bold",
    accent: "#2563eb",
    bio: "Helping revenue teams close faster with Northwind. Always happy to talk shop ☕",
    socials: [
      { label: "LinkedIn", href: "https://linkedin.com/in/alexmorgan" },
      { label: "Instagram", href: "https://instagram.com/alex.sells" },
      { label: "Website", href: "https://northwind.io" },
    ],
    links: [
      { emoji: "📅", label: "Book a 15-min demo" },
      { emoji: "📊", label: "See customer case studies" },
    ],
    traffic: { card: "1,248", links: "593" },
    leads: [
      { name: "Sarah Chen", initial: "S", source: "LinkedIn", color: "#0A66C2", status: "New Contact", time: "2m ago" },
      { name: "Priya Patel", initial: "P", source: "Instagram", color: "#E1306C", status: "New Contact", time: "1h ago" },
      { name: "James Carter", initial: "J", source: "Share Link", color: "#10B981", status: "Touch", time: "Yesterday" },
    ],
    data: {
      name: "Alex Morgan", title: "Account Executive", company: "Northwind SaaS",
      phone: "(415) 555-0142", email: "alex@northwind.io", website: "northwind.io",
      address: "", instagram: "", linkedin: "", initials: "AM", photoUrl: null, logoUrl: null,
      customization: { accentColor: "#2563eb" },
    },
  },
  {
    key: "realestate",
    label: "Real Estate Card",
    handle: "demo-realty",
    template: "local-business",
    accent: "#d97706",
    bio: "Coastal & city homes across the Bay Area. Tap below to browse listings or book a tour 🏡",
    socials: [
      { label: "Instagram", href: "https://instagram.com/alex.coastalhomes" },
      { label: "Facebook", href: "https://facebook.com/coastlinerealty" },
      { label: "Website", href: "https://coastlinehomes.com" },
    ],
    links: [
      { emoji: "🏡", label: "Browse active listings" },
      { emoji: "📆", label: "Schedule a private tour" },
    ],
    traffic: { card: "2,034", links: "874" },
    leads: [
      { name: "Marcus Webb", initial: "M", source: "QR Code", color: "#1D4ED8", status: "Touch", time: "12m ago" },
      { name: "Elena Ruiz", initial: "E", source: "Website", color: "#0EA5E9", status: "New Contact", time: "2h ago" },
      { name: "David Kim", initial: "D", source: "NFC Tap", color: "#7C3AED", status: "New Contact", time: "Yesterday" },
    ],
    data: {
      name: "Alex Morgan", title: "Realtor®", company: "Coastline Realty",
      phone: "(415) 555-0188", email: "alex@coastlinerealty.com", website: "coastlinehomes.com",
      address: "1200 Ocean Ave\nSan Francisco, CA 94122", instagram: "", linkedin: "", initials: "AM", photoUrl: null, logoUrl: null,
      customization: { accentColor: "#d97706" },
    },
  },
];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "New Contact": { bg: "rgba(59,130,246,0.15)", text: "#93c5fd" },
  "Touch": { bg: "rgba(245,158,11,0.15)", text: "#fcd34d" },
  "Dissolved": { bg: "rgba(107,114,128,0.18)", text: "#9ca3af" },
};

function Box({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return <div onClick={onClick} className={`bg-gray-900 border border-gray-800/80 rounded-2xl p-5 ${className}`}>{children}</div>;
}

// Card template rendered at a chosen scale (zoom keeps layout tight, no empty space).
function CardRender({ card, zoom = 0.8 }: { card: DemoCard; zoom?: number }) {
  const T = TEMPLATE_MAP[card.template] ?? ClassicPro;
  return (
    <div style={{ zoom }}>
      <div style={{ width: 360 }}>
        <T data={withoutSocials(card.data)} />
      </div>
    </div>
  );
}

// Full-page takeover with a top bar (title, open-in-new-tab, ✕).
function FullScreen({ title, href, onClose, children }: { title: string; href?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      <div className="shrink-0 h-14 px-4 sm:px-6 flex items-center justify-between border-b border-gray-800">
        <p className="text-white font-semibold text-sm truncate">{title}</p>
        <div className="flex items-center gap-4 shrink-0">
          {href && <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 font-medium hidden sm:inline">Open in new tab ↗</a>}
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white flex items-center justify-center text-lg leading-none">✕</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto flex items-start sm:items-center justify-center p-4 sm:p-8">{children}</div>
    </div>
  );
}

// A real public page shown inside a phone frame via iframe (exactly how it looks live).
function IframePhone({ src }: { src: string }) {
  return (
    <div className="rounded-[2.4rem] p-2.5 shrink-0" style={{ width: 384, maxWidth: "100%", background: "#0f172a", border: "2px solid #1e293b", boxShadow: "0 40px 90px -30px rgba(0,0,0,0.7)" }}>
      <div className="relative overflow-hidden bg-white" style={{ borderRadius: "1.9rem", height: "min(720px, 74vh)" }}>
        <iframe src={src} title="SwiftCard live preview" className="w-full h-full" style={{ border: 0 }} />
      </div>
    </div>
  );
}

export default function PreviewClient() {
  const [activeKey, setActiveKey] = useState<DemoCard["key"]>("sales");
  const [modal, setModal] = useState<null | "card" | "links" | "signature">(null);
  const [copied, setCopied] = useState(false);
  const card = CARDS.find((c) => c.key === activeKey)!;
  const firstName = card.data.name.split(" ")[0];

  function copySig() {
    const text = `${card.data.name}\nhttps://swiftcard.me/card/${card.handle}`;
    try { navigator.clipboard?.writeText(text); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-gray-950/90 backdrop-blur border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <SwiftCardLogo size={26} wordmark={false} onDark />
            <span className="font-bold text-sm">SwiftCard</span>
            <span className="text-gray-600 text-xs hidden sm:inline">· See it live</span>
          </Link>
          <Link href="/join" className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors">Start free →</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-7">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">See how we work — and how it all looks, live</h1>
          <p className="text-gray-500 text-sm mt-1.5">Switch between cards and tap any preview. This is the real interface with sample data — nothing to install.</p>
        </div>

        {/* My Cards — interactive switch */}
        <Box className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white font-semibold text-sm">My Cards</p>
              <p className="text-gray-600 text-xs mt-0.5">Tap a card to switch — everything below updates to that card.</p>
            </div>
            <span className="text-xs text-blue-400 font-medium">+ Add card</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CARDS.map((c) => {
              const active = c.key === activeKey;
              return (
                <button key={c.key} onClick={() => setActiveKey(c.key)} type="button"
                  className={`text-left flex items-center gap-3 rounded-xl px-4 py-3 border flex-1 min-w-full sm:min-w-[230px] transition-colors ${active ? "bg-blue-600/10 border-blue-600/40" : "bg-gray-800/60 border-gray-700/60 hover:border-gray-600"}`}>
                  <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 ${active ? "bg-blue-600 border-blue-600" : "border-gray-600"}`}>
                    {active && <svg viewBox="0 0 20 20" fill="white" className="w-3 h-3"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" /></svg>}
                  </span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{ background: c.accent }}>{c.label[0]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{c.label}</p>
                    <p className="text-gray-500 text-xs truncate">/{c.handle} · {c.data.title}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Box>

        {/* Top row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.85fr_0.72fr_0.7fr] gap-4 mb-5">
          {/* Traffic */}
          <Box>
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-semibold text-sm">Traffic</p>
              <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
                {["Today", "Week", "Month"].map((r, i) => (
                  <span key={r} className={`text-xs font-semibold px-2.5 py-1 rounded-md ${i === 1 ? "bg-gray-700 text-white" : "text-gray-500"}`}>{r}</span>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "SwiftCard Views", sub: "from your business card link", value: card.traffic.card },
                { label: "SwiftLink Views", sub: "from your Swift Links page", value: card.traffic.links },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between bg-gray-800/40 border border-gray-800 rounded-xl px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-gray-100 text-sm font-semibold">{m.label}</p>
                    <p className="text-gray-600 text-[11px]">{m.sub}</p>
                  </div>
                  <p className="text-2xl font-bold text-white tabular-nums shrink-0">{m.value}</p>
                </div>
              ))}
            </div>
          </Box>

          {/* Swift Links → open modal */}
          <Box>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Swift Links</p>
            <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 mb-2">
              <span className="text-blue-400 text-xs truncate flex-1">swiftcard.me/links/{card.handle}</span>
            </div>
            <button type="button" onClick={() => setModal("links")} className="block w-full text-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full py-2 transition-colors">
              Open Swift Links →
            </button>
          </Box>

          {/* Email signature → open modal */}
          <Box>
            <p className="text-white font-semibold text-sm">Email signature</p>
            <p className="text-gray-500 text-[11px] mt-1 leading-relaxed">Your live card in every email you send.</p>
            <button type="button" onClick={() => setModal("signature")} className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 rounded-full transition-colors">
              Preview &amp; copy
            </button>
          </Box>
        </div>

        {/* Main: contacts + card panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          {/* Contacts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-white font-semibold text-sm">Contacts</h2>
                <span className="text-white font-bold text-lg tabular-nums">{activeKey === "sales" ? "87" : "143"}</span>
                <span className="text-gray-500 text-[11px] font-medium">Total leads</span>
              </div>
              <span className="text-xs text-gray-300 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg">+ Add contact</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex items-center bg-gray-800/80 rounded-lg p-0.5">
                {["Notifications", "List", "Pipeline"].map((v, i) => (
                  <span key={v} className={`text-xs font-medium px-3 py-1 rounded-md ${i === 0 ? "bg-gray-700 text-white" : "text-gray-500"}`}>{v}</span>
                ))}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {["All", "New Contact", "Touch", "Dissolved"].map((s, i) => (
                  <span key={s} className={`text-xs px-2.5 py-1 rounded-md ${i === 0 ? "bg-blue-600/20 text-blue-300 border border-blue-600/40" : "text-gray-500 border border-gray-800"}`}>{s}</span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {card.leads.map((l) => (
                <div key={l.name} className="bg-gray-900 border border-gray-800/80 rounded-2xl px-4 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white" style={{ background: l.color }}>{l.initial}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-semibold truncate">{l.name}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: l.color + "22", color: l.color }}>{l.source}</span>
                    </div>
                    <p className="text-gray-500 text-xs truncate mt-0.5">Shared their contact with {firstName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: STATUS_STYLE[l.status].bg, color: STATUS_STYLE[l.status].text }}>{l.status}</span>
                    <span className="text-gray-600 text-[10px]">{l.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Your Card (tap to preview) + Share */}
          <div className="flex flex-col gap-4">
            <Box>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Your Card</p>
              <button type="button" onClick={() => setModal("card")} className="block w-full rounded-xl overflow-hidden" style={{ maxHeight: 230 }}>
                <CardRender card={card} zoom={0.72} />
              </button>
              <button type="button" onClick={() => setModal("card")} className="mt-3 w-full text-xs font-semibold text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full py-2 transition-colors">
                Preview SwiftCard →
              </button>
            </Box>
            <Box className="space-y-2">
              <div className="w-full bg-blue-600 text-white font-semibold text-sm py-2.5 rounded-full text-center">Share</div>
              <div className="w-full text-gray-400 text-xs py-2 rounded-full text-center border border-gray-800">More ways to share</div>
            </Box>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <p className="text-gray-400 text-sm mb-3">This is exactly what you get — set up your own in under a minute.</p>
          <Link href="/join" className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-full transition-colors">Create your free card →</Link>
        </div>
      </div>

      {/* ── Full-page live previews (real pages in an iframe) ── */}
      {modal === "card" && (
        <FullScreen title={`${card.label} — your live SwiftCard`} href={`/card/${card.handle}`} onClose={() => setModal(null)}>
          <IframePhone src={`/card/${card.handle}`} />
        </FullScreen>
      )}

      {modal === "links" && (
        <FullScreen title="Swift Links — your live link-in-bio page" href={`/links/${card.handle}`} onClose={() => setModal(null)}>
          <IframePhone src={`/links/${card.handle}`} />
        </FullScreen>
      )}

      {modal === "signature" && (
        <FullScreen title="Email signature" onClose={() => setModal(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 w-full max-w-md">
            <p className="text-gray-500 text-xs mb-3">Here&apos;s how it looks at the bottom of an email you send:</p>
            <div className="rounded-xl border border-gray-700/60 bg-white overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-200 text-[12px] text-gray-500 space-y-0.5">
                <p><span className="text-gray-400">To:</span> sarah@acme.com</p>
                <p><span className="text-gray-400">Subject:</span> Great connecting today</p>
              </div>
              <div className="px-4 py-3 text-[13px] text-gray-800 leading-relaxed">
                <p>Hi Sarah,</p>
                <p className="mt-2">Really enjoyed chatting earlier. My contact info is below in my signature. Let&apos;s keep in touch!</p>
                <p className="mt-2">Best,</p>
                <div className="mt-3">
                  <p className="text-[14px] text-gray-900 mb-1.5"><strong>{card.data.name}</strong> | {card.data.company}</p>
                  <div className="rounded-[10px] overflow-hidden border border-gray-200 w-[230px] max-w-full"><CardRender card={card} zoom={0.5} /></div>
                  <span className="inline-block mt-2 text-[14px] font-bold text-blue-600">Contact me</span>
                </div>
              </div>
            </div>
            <button onClick={copySig} className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm py-2.5 rounded-full transition-colors">
              {copied ? "Copied ✓ — paste it into your email signature" : "Copy signature"}
            </button>
            <p className="text-gray-600 text-[11px] mt-2 text-center">Paste into <strong className="text-gray-400">Gmail → Settings → Signature</strong>.</p>
          </div>
        </FullScreen>
      )}
    </main>
  );
}
