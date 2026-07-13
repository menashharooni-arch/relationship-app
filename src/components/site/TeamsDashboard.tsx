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

// A real, interactive Teams product surface. The admin changes the company
// template, accent color, or logo once (top of the "Brand kit" panel) and every
// teammate's actual SwiftCard — rendered with the live templates — updates
// instantly. Also covers: office groups, team directory, roles & permissions,
// add/remove members, and lead ownership. All fictional/local.

const COMPANY = "Meridian Realty";
const WEBSITE = "meridianrealty.com";

const TEMPLATES = { "classic-pro": ClassicPro, "modern-bold": ModernBold, "photo-first": PhotoFirst, "local-business": LocalBusiness, "luxury-minimal": LuxuryMinimal } as const;
type TemplateId = keyof typeof TEMPLATES;
const TEMPLATE_CHIPS: { id: TemplateId; label: string }[] = [
  { id: "classic-pro", label: "Classic" }, { id: "modern-bold", label: "Modern" }, { id: "photo-first", label: "Photo" }, { id: "local-business", label: "Local" }, { id: "luxury-minimal", label: "Luxury" },
];

const ACCENTS = ["#2563EB", "#0EA5A0", "#7C3AED", "#DC2626", "#EA580C", "#059669"];
const FONTS = [
  { label: "Sans", value: "var(--font-geist-sans), system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
];

type Role = "Admin" | "Manager" | "Member";
type Member = { id: string; name: string; title: string; initials: string; email: string; phone: string; role: Role; office: string; leads: number; avatar: number };

const OFFICES = ["San Francisco", "New York", "Austin"];
const SEED: Member[] = [
  { id: "alex", name: "Alex Morgan", title: "Managing Broker", initials: "AM", email: "alex@meridianrealty.com", phone: "(415) 555-0188", role: "Admin", office: "San Francisco", leads: 128, avatar: 0 },
  { id: "priya", name: "Priya Shah", title: "Senior Agent", initials: "PS", email: "priya@meridianrealty.com", phone: "(415) 555-0142", role: "Manager", office: "San Francisco", leads: 94, avatar: 1 },
  { id: "marcus", name: "Marcus Lee", title: "Agent", initials: "ML", email: "marcus@meridianrealty.com", phone: "(212) 555-0119", role: "Member", office: "New York", leads: 61, avatar: 2 },
  { id: "dana", name: "Dana Ruiz", title: "Marketing Lead", initials: "DR", email: "dana@meridianrealty.com", phone: "(212) 555-0164", role: "Manager", office: "New York", leads: 47, avatar: 3 },
  { id: "elena", name: "Elena Diaz", title: "Agent", initials: "ED", email: "elena@meridianrealty.com", phone: "(737) 555-0155", role: "Member", office: "Austin", leads: 52, avatar: 4 },
];

const ROLE_STYLES: Record<Role, string> = {
  Admin: "bg-blue-950 text-blue-300 border-blue-800/60",
  Manager: "bg-violet-950 text-violet-300 border-violet-800/60",
  Member: "bg-white/[0.06] text-white/50 border-white/10",
};
const PERMS: Record<Role, { brand: boolean; members: boolean; leads: boolean }> = {
  Admin: { brand: true, members: true, leads: true },
  Manager: { brand: false, members: true, leads: true },
  Member: { brand: false, members: false, leads: false },
};


// Illustrated teammate portraits — flat vector busts as data URIs. Clearly
// fictional (no stock photos of real people), diverse, and consistent with the
// demo's "sample company" framing.
type AvatarSpec = { bg: string; skin: string; hair: string; shirt: string; style: "short" | "long" | "bun" | "beard" | "curly" | "crop" };
const AVATARS: AvatarSpec[] = [
  { bg: "#DBEAFE", skin: "#E8B48E", hair: "#2F2A26", shirt: "#1D4ED8", style: "short" },
  { bg: "#FCE7F3", skin: "#AD7D52", hair: "#141210", shirt: "#0F766E", style: "long"  },
  { bg: "#ECFDF5", skin: "#F2C9A4", hair: "#6B4A2B", shirt: "#7C3AED", style: "beard" },
  { bg: "#FEF3C7", skin: "#8A5A3B", hair: "#0E0C0A", shirt: "#DC2626", style: "bun"   },
  { bg: "#E0E7FF", skin: "#D9A075", hair: "#3B2417", shirt: "#EA580C", style: "curly" },
  { bg: "#F1F5F9", skin: "#C68A5B", hair: "#4A3524", shirt: "#059669", style: "crop"  },
];
function avatarUri(i: number): string {
  const a = AVATARS[i % AVATARS.length];
  const hair =
    a.style === "long"
      ? `<path d='M28 40c0-13 9-21 20-21s20 8 20 21v16c0 4-4 6-6 3v-16H34v16c-2 3-6 1-6-3z' fill='${a.hair}'/>`
      : a.style === "bun"
        ? `<circle cx='48' cy='16' r='7' fill='${a.hair}'/><path d='M31 38c1-11 8-17 17-17s16 6 17 17c0 2-3 3-4 1-2-5-7-8-13-8s-11 3-13 8c-1 2-4 1-4-1z' fill='${a.hair}'/>`
        : a.style === "curly"
          ? `<path d='M30 36c0-10 8-17 18-17s18 7 18 17c0 3-4 4-5 1a6 6 0 0 0-4-4 7 7 0 0 1-9-2 7 7 0 0 1-9 2 6 6 0 0 0-4 4c-1 3-5 2-5-1z' fill='${a.hair}'/><circle cx='31' cy='34' r='4' fill='${a.hair}'/><circle cx='65' cy='34' r='4' fill='${a.hair}'/>`
          : a.style === "crop"
            ? `<path d='M32 36c1-9 7-15 16-15s15 6 16 15c0 2-2 2-3 1-3-4-8-6-13-6s-10 2-13 6c-1 1-3 1-3-1z' fill='${a.hair}'/>`
            : `<path d='M31 37c0-11 8-18 17-18s17 7 17 18c0 2-3 3-4 1-2-5-7-8-13-8s-11 3-13 8c-1 2-4 1-4-1z' fill='${a.hair}'/>`;
  const beard = a.style === "beard"
    ? `<path d='M36 46c0 8 5 13 12 13s12-5 12-13c0 11-4 17-12 17s-12-6-12-17z' fill='${a.hair}'/>`
    : "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'>`
    + `<rect width='96' height='96' rx='14' fill='${a.bg}'/>`
    + `<path d='M14 96c3-19 17-27 34-27s31 8 34 27z' fill='${a.shirt}'/>`
    + `<circle cx='48' cy='40' r='17' fill='${a.skin}'/>`
    + hair + beard
    + `<circle cx='42' cy='40' r='1.7' fill='#1f2937'/><circle cx='54' cy='40' r='1.7' fill='#1f2937'/>`
    + `<path d='M43 48q5 4 10 0' stroke='#1f2937' stroke-width='1.6' fill='none' stroke-linecap='round'/>`
    + `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

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

const PANEL = "rounded-2xl border border-white/8 bg-white/[0.02] p-4";

export default function TeamsDashboard() {
  const [members, setMembers] = useState<Member[]>(SEED);
  const [group, setGroup] = useState<string>("All");
  const [selectedId, setSelectedId] = useState<string>(SEED[0].id);
  // Brand kit — changing any of these updates EVERY card at once.
  const [template, setTemplate] = useState<TemplateId>("photo-first");
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  const [logo, setLogo] = useState<string>("mono");
  const [font, setFont] = useState<string>(FONTS[0].value);
  const [flash, setFlash] = useState(false);

  const Template = TEMPLATES[template];
  const logoUrl = logoUri(logo, accent);
  const visible = group === "All" ? members : members.filter((m) => m.office === group);
  const selected = members.find((m) => m.id === selectedId) ?? members[0];

  // Pulse the cards briefly so the "updates instantly" story reads.
  function brandChange<T>(setter: (v: T) => void, v: T) {
    setter(v);
    setFlash(true);
    setTimeout(() => setFlash(false), 650);
  }

  function cardData(m: Member): CardData {
    return withoutSocials({
      name: m.name, title: m.title, company: COMPANY, phone: m.phone, email: m.email, website: WEBSITE,
      initials: m.initials, photoUrl: avatarUri(m.avatar), logoUrl,
      customization: { accentColor: accent, fontFamily: font },
      cardUrl: `swiftcard.me/card/${m.id}`,
    });
  }

  function addMember() {
    const n = members.length + 1;
    const office = group === "All" ? "San Francisco" : group;
    const nm: Member = { id: `new-${n}-${office}`, name: "New Teammate", title: "Agent", initials: "NT", email: `new${n}@meridianrealty.com`, phone: "(000) 000-0000", role: "Member", office, leads: 0, avatar: n % AVATARS.length };
    setMembers((ms) => [...ms, nm]);
    setSelectedId(nm.id);
  }
  function removeMember(id: string) {
    setMembers((ms) => {
      const next = ms.filter((m) => m.id !== id);
      if (id === selectedId && next[0]) setSelectedId(next[0].id);
      return next;
    });
  }
  function setRole(id: string, role: Role) {
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, role } : m)));
  }

  const totalLeads = members.reduce((s, m) => s + m.leads, 0);
  const perms = PERMS[selected.role];

  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0A0B10] shadow-2xl overflow-hidden">
      {/* browser chrome */}
      <div className="flex items-center gap-2 px-4 h-11 border-b border-white/8 bg-[#0E1017]">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex-1 max-w-[280px] h-6 rounded-md bg-white/[0.05] flex items-center px-3 gap-1.5">
          <svg viewBox="0 0 24 24" className="w-3 h-3 text-white/30" fill="none" stroke="currentColor" strokeWidth={2}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
          <span className="text-white/40 text-[11px]">swiftcard.me/team</span>
        </div>
      </div>

      <div className="p-4 sm:p-5 grid lg:grid-cols-[248px_1fr] gap-4">
        {/* ── SIDEBAR ── */}
        <aside className="space-y-4">
          <div className={PANEL}>
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" className="w-9 h-9 rounded-[10px]" />
              <div>
                <p className="text-white font-bold text-[14px] leading-tight">{COMPANY}</p>
                <p className="text-white/40 text-[11px]">Office plan · {members.length} seats</p>
              </div>
            </div>
          </div>

          <div className={PANEL}>
            <p className="text-white/45 text-[11px] font-semibold uppercase tracking-wide mb-2.5">Offices</p>
            <div className="space-y-1">
              {["All", ...OFFICES].map((o) => (
                <button key={o} onClick={() => setGroup(o)} className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] transition-colors ${group === o ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"}`}>
                  <span className="flex items-center gap-2">{o !== "All" && "📍"} {o}</span>
                  <span className="text-white/30 text-[11px]">{o === "All" ? members.length : members.filter((m) => m.office === o).length}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={PANEL}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-white/45 text-[11px] font-semibold uppercase tracking-wide">Team</p>
              <button onClick={addMember} className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors">+ Add</button>
            </div>
            <div className="space-y-1">
              {visible.map((m) => (
                <div key={m.id} className={`group flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${m.id === selectedId ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"}`} onClick={() => setSelectedId(m.id)}>
                  <img src={avatarUri(m.avatar)} alt="" className="w-7 h-7 rounded-full shrink-0 object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-white text-[12px] font-semibold truncate leading-tight">{m.name}</span>
                    <span className="block text-white/40 text-[10px] truncate">{m.leads} leads</span>
                  </span>
                  <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border ${ROLE_STYLES[m.role]}`}>{m.role}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeMember(m.id); }} className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all" aria-label="Remove">×</button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="space-y-4 min-w-0">
          {/* Brand kit */}
          <div className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <p className="text-white font-semibold text-[15px]">Brand kit</p>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${flash ? "bg-blue-600 text-white" : "bg-white/[0.06] text-white/50"}`}>
                {flash ? "✓ Every card updated" : "Change once — every card updates instantly"}
              </span>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {/* Template */}
              <div>
                <p className="text-white/45 text-[11px] font-semibold mb-2">Company template</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_CHIPS.map((t) => (
                    <button key={t.id} onClick={() => brandChange(setTemplate, t.id)} className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${template === t.id ? "bg-white/12 text-white" : "bg-white/[0.03] text-white/45 hover:text-white/70"}`}>{t.label}</button>
                  ))}
                </div>
              </div>
              {/* Accent */}
              <div>
                <p className="text-white/45 text-[11px] font-semibold mb-2">Accent color</p>
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((c) => (
                    <button key={c} onClick={() => brandChange(setAccent, c)} className="w-7 h-7 rounded-full transition-transform hover:scale-110" style={{ background: c, outline: accent === c ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2 }} aria-label={c} />
                  ))}
                </div>
              </div>
              {/* Logo + font */}
              <div>
                <p className="text-white/45 text-[11px] font-semibold mb-2">Logo &amp; type</p>
                <div className="flex items-center gap-2">
                  {["mono", "bolt", "ring"].map((s) => (
                    <button key={s} onClick={() => brandChange(setLogo, s)} className="rounded-[10px] transition-transform hover:scale-105" style={{ outline: logo === s ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2 }} aria-label={s}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoUri(s, accent)} alt="" className="w-8 h-8 rounded-[10px] block" />
                    </button>
                  ))}
                  <div className="flex gap-1 ml-1">
                    {FONTS.map((ff) => (
                      <button key={ff.label} onClick={() => brandChange(setFont, ff.value)} className={`text-[11px] px-2 py-1 rounded-lg transition-colors ${font === ff.value ? "bg-white/12 text-white" : "bg-white/[0.03] text-white/45"}`}>{ff.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selected member — roles, permissions, lead ownership */}
          <div className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img src={avatarUri(selected.avatar)} alt="" className="w-9 h-9 rounded-full shrink-0 object-cover" />
                <div className="min-w-0">
                  <p className="text-white font-semibold text-[14px] leading-tight truncate">{selected.name}</p>
                  <p className="text-white/40 text-[11px] truncate">{selected.title} · {selected.office}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-[11px]">Role</span>
                <select value={selected.role} onChange={(e) => setRole(selected.id, e.target.value as Role)} className="bg-white/[0.06] border border-white/10 text-white text-[12px] rounded-lg px-2 py-1 focus:outline-none">
                  {(["Admin", "Manager", "Member"] as Role[]).map((r) => <option key={r} value={r} className="bg-[#0E1017]">{r}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              {[["Manage brand", perms.brand], ["Add / remove members", perms.members], ["Export leads", perms.leads]].map(([label, on]) => (
                <span key={label as string} className="flex items-center gap-1.5 text-[12px]">
                  <span className={`w-4 h-4 rounded flex items-center justify-center ${on ? "bg-blue-600 text-white" : "bg-white/[0.06] text-white/30"}`}>{on ? "✓" : "–"}</span>
                  <span className={on ? "text-white/75" : "text-white/35"}>{label}</span>
                </span>
              ))}
              <span className="ml-auto text-[12px] text-white/50">Owns <span className="text-white font-semibold tabular-nums">{selected.leads}</span> leads · team total <span className="text-white font-semibold tabular-nums">{totalLeads}</span></span>
            </div>
          </div>

          {/* Every teammate's real SwiftCard — updates live with the brand kit */}
          <div className={`grid sm:grid-cols-2 xl:grid-cols-3 gap-4 transition-[filter] duration-300 ${flash ? "[filter:brightness(1.06)]" : ""}`}>
            {visible.map((m) => (
              <div key={m.id} className={`rounded-2xl border p-2.5 transition-colors ${m.id === selectedId ? "border-white/25 bg-white/[0.03]" : "border-white/8 bg-white/[0.01]"}`}>
                <div className="rounded-xl overflow-hidden">
                  <CardScaler><Template data={cardData(m)} /></CardScaler>
                </div>
                <div className="flex items-center justify-between mt-2 px-0.5">
                  <span className="text-white/70 text-[11.5px] font-semibold truncate">{m.name}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${ROLE_STYLES[m.role]}`}>{m.role}</span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
