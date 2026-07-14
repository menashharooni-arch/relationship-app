"use client";

import { useState } from "react";
import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import { withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";

// A replica of the REAL Office admin at /office/admin — same three tabs (Team,
// Leads, Branding), same dark panels, same purple accent, same copy. It was
// previously a different product entirely: an "Offices" sidebar with San
// Francisco/New York/Austin groups, Admin/Manager/Member roles and a "Brand kit"
// panel, none of which exist. A prospect who bought on the strength of that
// screenshot would not recognise what they logged into.
//
// Interactive and fictional — nothing is fetched. The Branding tab still drives
// every card live, because "change it once, everyone updates" is the actual
// promise of the section this sits under.

const COMPANY = "Meridian Realty";
const WEBSITE = "meridianrealty.com";

const TEMPLATES = { "classic-pro": ClassicPro, "modern-bold": ModernBold, "photo-first": PhotoFirst, "local-business": LocalBusiness, "luxury-minimal": LuxuryMinimal } as const;
type TemplateId = keyof typeof TEMPLATES;
const TEMPLATE_CHIPS: { id: TemplateId; label: string }[] = [
  { id: "classic-pro", label: "Classic Pro" }, { id: "modern-bold", label: "Modern Bold" }, { id: "photo-first", label: "Photo First" }, { id: "local-business", label: "Local Business" }, { id: "luxury-minimal", label: "Luxury Minimal" },
];

const ACCENTS = ["#2563EB", "#0EA5A0", "#7C3AED", "#DC2626", "#EA580C", "#059669"];

type Person = {
  id: string; name: string; title: string; initials: string; email: string; phone: string;
  views: number; leads: number; lastActive: string; active: boolean; owner?: boolean; avatar: number;
};

// Real teammate headshots (Unsplash — free for commercial use, no attribution
// required). A fictional sample company, so the faces are stock portraits.
const TEAM_PHOTOS = [
  "/marketing/team/person1.jpg",
  "/marketing/team/person2.jpg",
  "/marketing/team/person3.jpg",
  "/marketing/team/person4.jpg",
  "/marketing/team/person5.jpg",
  "/marketing/team/person6.jpg",
];
const teamPhoto = (i: number): string => TEAM_PHOTOS[i % TEAM_PHOTOS.length];

const PEOPLE: Person[] = [
  { id: "alex", name: "Alex Morgan", title: "Managing Broker", initials: "AM", email: "alex@meridianrealty.com", phone: "(415) 555-0188", views: 1240, leads: 128, lastActive: "2 hours ago", active: true, owner: true, avatar: 0 },
  { id: "sofia", name: "Sofia Reyes", title: "Senior Agent", initials: "SR", email: "sofia@meridianrealty.com", phone: "(415) 555-0142", views: 903, leads: 94, lastActive: "Yesterday", active: true, avatar: 1 },
  { id: "marcus", name: "Marcus Lee", title: "Agent", initials: "ML", email: "marcus@meridianrealty.com", phone: "(212) 555-0119", views: 588, leads: 61, lastActive: "3 days ago", active: true, avatar: 2 },
  { id: "elena", name: "Elena Diaz", title: "Agent", initials: "ED", email: "elena@meridianrealty.com", phone: "(737) 555-0155", views: 511, leads: 52, lastActive: "5 days ago", active: true, avatar: 4 },
  { id: "dana", name: "Dana Ruiz", title: "Marketing Lead", initials: "DR", email: "dana@meridianrealty.com", phone: "(212) 555-0164", views: 96, leads: 4, lastActive: "3 weeks ago", active: false, avatar: 3 },
];

const PENDING = { email: "priya@meridianrealty.com", sent: "Jul 12" };

const LEADS = [
  { id: "l1", name: "Sarah Chen", contact: "sarah@acme.com", by: "Sofia Reyes", worked: true, label: "Contacted", when: "2 hours ago" },
  { id: "l2", name: "Marcus Webb", contact: "m.webb@northgate.co", by: "Alex Morgan", worked: false, label: "New", when: "Yesterday" },
  { id: "l3", name: "Jordan Kim", contact: "(415) 555-0173", by: "Marcus Lee", worked: false, label: "New", when: "Yesterday" },
  { id: "l4", name: "Elena Diaz", contact: "elena@brightpath.io", by: "Elena Diaz", worked: true, label: "Closed", when: "4 days ago" },
  { id: "l5", name: "Tom Farrell", contact: "tom@farrell.dev", by: "Sofia Reyes", worked: true, label: "Contacted", when: "1 week ago" },
];

// Company logo mark as an SVG data URI (recolored by the brand accent).
function logoUri(shape: string, color: string): string {
  const glyph = shape === "bolt"
    ? `<polygon points='27,8 16,27 23,27 20,40 33,20 26,20' fill='white'/>`
    : shape === "ring"
      ? `<circle cx='24' cy='24' r='10' fill='none' stroke='white' stroke-width='5'/>`
      : `<text x='24' y='32' font-family='Arial' font-size='23' font-weight='700' fill='white' text-anchor='middle'>M</text>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><rect width='48' height='48' rx='12' fill='${color}'/>${glyph}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

type Tab = "Team" | "Leads" | "Branding";
const TABS: Tab[] = ["Team", "Leads", "Branding"];

// Mirrors the real StatTile + explainer line on /office/admin.
function BigStat({ label, value, delta, explainer }: { label: string; value: string; delta?: string; explainer: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4">
      <p className="text-[11px] text-gray-500">{label}</p>
      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
        <p className="text-[26px] font-bold text-white tabular-nums leading-none">{value}</p>
        {delta && <span className="text-[10px] font-bold text-green-400">▲ {delta}</span>}
      </div>
      <p className="text-[10.5px] text-gray-600 mt-1.5 leading-snug">{explainer}</p>
    </div>
  );
}

function Chip({ tone, children }: { tone: "green" | "amber" | "gray"; children: React.ReactNode }) {
  const tones = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    gray: "bg-gray-800 text-gray-400 border-gray-700",
  } as const;
  return <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export default function TeamsDashboard() {
  const [tab, setTab] = useState<Tab>("Team");
  const [template, setTemplate] = useState<TemplateId>("photo-first");
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  const [logo, setLogo] = useState<string>("mono");
  const [flash, setFlash] = useState(false);

  const Template = TEMPLATES[template];
  const logoUrl = logoUri(logo, accent);

  // Pulse the cards briefly so the "updates instantly" story reads.
  function brandChange<T>(setter: (v: T) => void, v: T) {
    setter(v);
    setFlash(true);
    setTimeout(() => setFlash(false), 650);
  }

  function cardData(p: Person): CardData {
    return withoutSocials({
      name: p.name, title: p.title, company: COMPANY, phone: p.phone, email: p.email, website: WEBSITE,
      initials: p.initials, photoUrl: teamPhoto(p.avatar), logoUrl,
      customization: { accentColor: accent },
      cardUrl: `swiftcard.me/card/${p.id}`,
    });
  }

  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0A0B10] shadow-2xl overflow-hidden">
      {/* browser chrome */}
      <div className="flex items-center gap-2 px-4 h-11 border-b border-white/8 bg-[#0E1017]">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex-1 max-w-[280px] h-6 rounded-md bg-white/[0.05] flex items-center px-3 gap-1.5">
          <svg viewBox="0 0 24 24" className="w-3 h-3 text-white/30" fill="none" stroke="currentColor" strokeWidth={2}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
          <span className="text-white/40 text-[11px]">swiftcard.me/office/admin</span>
        </div>
      </div>

      {/* app header + tabs — the real admin's shell */}
      <div className="bg-gray-950 border-b border-gray-800/80 px-4 sm:px-5">
        <div className="flex items-center justify-between h-11">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[9px] font-bold tracking-[0.25em] text-slate-500 uppercase shrink-0">SwiftCard</span>
            <span className="text-[10px] font-bold bg-purple-600/20 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full shrink-0">Admin</span>
            <span className="text-[11px] text-gray-500 truncate hidden sm:block">{COMPANY}</span>
          </div>
          <span className="text-[11px] text-gray-600 shrink-0">← My dashboard</span>
        </div>
        <div className="flex gap-1 -mb-px">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors ${
                tab === t ? "border-purple-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-950 p-4 sm:p-5">
        {/* ── TEAM ── */}
        {tab === "Team" && (
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[17px] font-bold text-white tracking-tight">Your team</p>
                <p className="text-gray-500 text-[12px] mt-0.5">Everyone with a company card, and what those cards are bringing in.</p>
              </div>
              <span className="bg-purple-600 text-white text-[11.5px] font-semibold px-3 py-1.5 rounded-full shrink-0">+ Add team member</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <BigStat label="Leads captured this month" value="339" delta="18% vs last month" explainer="People who shared their info with your team" />
              <BigStat label="Card views this month" value="3,338" delta="24% vs last month" explainer="Times someone opened one of your team's cards" />
              <BigStat label="Team members active" value="4" explainer="Teammates whose cards had views or leads this month" />
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900/60 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <p className="col-span-4">Person</p><p className="col-span-2">Views</p><p className="col-span-2">Leads</p><p className="col-span-2">Last active</p><p className="col-span-2">Status</p>
              </div>
              <div className="divide-y divide-gray-800">
                {PEOPLE.map((p) => (
                  <div key={p.id} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center">
                    <div className="col-span-12 md:col-span-4 min-w-0 flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={teamPhoto(p.avatar)} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[12.5px] text-white font-medium truncate">{p.name}</p>
                        {p.owner && <p className="text-[10px] text-purple-400">Owner (you)</p>}
                      </div>
                    </div>
                    <p className="col-span-4 md:col-span-2 text-[12.5px] text-gray-300 tabular-nums"><span className="md:hidden text-gray-600 text-[10px]">Views </span>{p.views.toLocaleString("en-US")}</p>
                    <p className="col-span-4 md:col-span-2 text-[12.5px] text-gray-300 tabular-nums"><span className="md:hidden text-gray-600 text-[10px]">Leads </span>{p.leads}</p>
                    <p className="col-span-4 md:col-span-2 text-[11px] text-gray-500">{p.lastActive}</p>
                    <div className="col-span-12 md:col-span-2">
                      {p.active ? <Chip tone="green">Active</Chip> : <Chip tone="amber">Not using it yet</Chip>}
                    </div>
                  </div>
                ))}
                {/* Pending invites live in the same table as real people. */}
                <div className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center">
                  <div className="col-span-12 md:col-span-4 min-w-0 flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-300 text-[10px] font-bold flex items-center justify-center shrink-0">PR</span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] text-gray-300 truncate">{PENDING.email}</p>
                      <p className="text-[10px] text-gray-600">Invite sent {PENDING.sent}</p>
                    </div>
                  </div>
                  <p className="col-span-4 md:col-span-2 text-[12.5px] text-gray-600">—</p>
                  <p className="col-span-4 md:col-span-2 text-[12.5px] text-gray-600">—</p>
                  <p className="col-span-4 md:col-span-2 text-[11px] text-gray-600">—</p>
                  <div className="col-span-12 md:col-span-2 flex items-center gap-2">
                    <Chip tone="gray">Invite sent</Chip>
                    <span className="text-[10px] font-semibold text-purple-300">Resend</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LEADS ── */}
        {tab === "Leads" && (
          <div>
            <div className="mb-4">
              <p className="text-[17px] font-bold text-white tracking-tight">Leads</p>
              <p className="text-gray-500 text-[12px] mt-0.5">Everyone who shared their info with your team — {LEADS.length} so far.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="flex-1 rounded-xl bg-gray-900 border border-gray-800 px-3 py-2 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg>
                <span className="text-gray-600 text-[12px]">Search by contact name…</span>
              </div>
              <div className="rounded-xl bg-gray-900 border border-gray-800 px-3 py-2 sm:w-52 flex items-center justify-between">
                <span className="text-gray-400 text-[12px]">Everyone on the team</span>
                <span className="text-gray-600 text-[9px]">▼</span>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900/60 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <p className="col-span-4">Contact</p><p className="col-span-3">Captured by</p><p className="col-span-2">Status</p><p className="col-span-3">When</p>
              </div>
              <div className="divide-y divide-gray-800">
                {LEADS.map((l) => (
                  <div key={l.id} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center">
                    <div className="col-span-12 md:col-span-4 min-w-0">
                      <p className="text-[12.5px] text-white truncate">{l.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{l.contact}</p>
                    </div>
                    {/* The person's NAME — never a card URL slug. */}
                    <p className="col-span-5 md:col-span-3 text-[11.5px] text-gray-400 truncate">{l.by}</p>
                    <div className="col-span-4 md:col-span-2">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${l.worked ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${l.worked ? "bg-green-400" : "bg-amber-400"}`} />
                        {l.label}
                      </span>
                    </div>
                    <p className="col-span-3 md:col-span-3 text-[11px] text-gray-600 whitespace-nowrap">{l.when}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10.5px] text-gray-600 mt-2.5">
              <span className="text-amber-400 font-semibold">New</span> = nobody has followed up yet.{" "}
              <span className="text-green-400 font-semibold">Contacted</span> / <span className="text-green-400 font-semibold">Closed</span> = someone on your team has handled it.
            </p>
          </div>
        )}

        {/* ── BRANDING ── */}
        {tab === "Branding" && (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[17px] font-bold text-white tracking-tight">Branding</p>
                <p className="text-gray-500 text-[12px] mt-0.5">Set this once — every card on your team automatically uses it.</p>
              </div>
              <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full transition-colors shrink-0 ${flash ? "bg-purple-600 text-white" : "bg-white/[0.06] text-white/50"}`}>
                {flash ? "✓ Every card updated" : "Try it — change anything below"}
              </span>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 mb-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-400 text-[11px] font-medium mb-2">Card style</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATE_CHIPS.map((t) => (
                      <button key={t.id} onClick={() => brandChange(setTemplate, t.id)} className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full transition-colors ${template === t.id ? "bg-purple-600 text-white" : "bg-gray-950 text-gray-400 border border-gray-800 hover:text-gray-200"}`}>{t.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-[11px] font-medium mb-2">Brand color</p>
                  <div className="flex flex-wrap gap-2">
                    {ACCENTS.map((c) => (
                      <button key={c} onClick={() => brandChange(setAccent, c)} className="w-7 h-7 rounded-full transition-transform hover:scale-110" style={{ background: c, outline: accent === c ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2 }} aria-label={`Brand color ${c}`} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-[11px] font-medium mb-2">Company logo</p>
                  <div className="flex items-center gap-2">
                    {["mono", "bolt", "ring"].map((s) => (
                      <button key={s} onClick={() => brandChange(setLogo, s)} className="rounded-[10px] transition-transform hover:scale-105" style={{ outline: logo === s ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2 }} aria-label={`Logo ${s}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoUri(s, accent)} alt="" className="w-8 h-8 rounded-[10px] block" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Every teammate's real SwiftCard — updates live with the brand */}
            <div className={`grid sm:grid-cols-2 xl:grid-cols-3 gap-3 transition-[filter] duration-300 ${flash ? "[filter:brightness(1.06)]" : ""}`}>
              {PEOPLE.slice(0, 3).map((p) => (
                <div key={p.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-2.5">
                  <div className="rounded-xl overflow-hidden">
                    <CardScaler><Template data={cardData(p)} /></CardScaler>
                  </div>
                  <p className="text-white/70 text-[11px] font-semibold truncate mt-2 px-0.5">{p.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
