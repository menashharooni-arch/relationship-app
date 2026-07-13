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
  { id: "priya", name: "Sofia Reyes", title: "Senior Agent", initials: "SR", email: "sofia@meridianrealty.com", phone: "(415) 555-0142", role: "Manager", office: "San Francisco", leads: 94, avatar: 1 },
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


// Real teammate headshots (Unsplash — free for commercial use, no attribution
// required). A fictional sample company, so the faces are stock portraits, not
// actual employees. Indexed by Member.avatar.
const TEAM_PHOTOS = [
  "/marketing/team/person1.jpg",
  "/marketing/team/person2.jpg",
  "/marketing/team/person3.jpg",
  "/marketing/team/person4.jpg",
  "/marketing/team/person5.jpg",
  "/marketing/team/person6.jpg",
];
const teamPhoto = (i: number): string => TEAM_PHOTOS[i % TEAM_PHOTOS.length];

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
      initials: m.initials, photoUrl: teamPhoto(m.avatar), logoUrl,
      customization: { accentColor: accent, fontFamily: font },
      cardUrl: `swiftcard.me/card/${m.id}`,
    });
  }

  function addMember() {
    const n = members.length + 1;
    const office = group === "All" ? "San Francisco" : group;
    const nm: Member = { id: `new-${n}-${office}`, name: "New Teammate", title: "Agent", initials: "NT", email: `new${n}@meridianrealty.com`, phone: "(000) 000-0000", role: "Member", office, leads: 0, avatar: n % TEAM_PHOTOS.length };
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
                  <span className="flex items-center gap-2">{o}</span>
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
                  <img src={teamPhoto(m.avatar)} alt="" className="w-7 h-7 rounded-full shrink-0 object-cover" />
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
                <img src={teamPhoto(selected.avatar)} alt="" className="w-9 h-9 rounded-full shrink-0 object-cover" />
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
