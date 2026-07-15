"use client";

import { useState } from "react";
import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import { withoutSocials } from "@/components/card-templates/types";

// A replica of the REAL Office admin at /office/admin — same three tabs (Team,
// Leads, Branding), same shell, same four BigStats, same table anatomy, same
// branding form. Structure, labels and styling are copied from:
//   - /office/admin (page.tsx BigStat + seats counter)
//   - components/office/TeamList.tsx (12-col table, Manage pill, invite row)
//   - /office/admin/leads/LeadsTable.tsx (three filters, 5-col table)
//   - /office/admin/branding + components/OfficeBranding.tsx (the real form)
// A prospect who buys on the strength of this demo logs into exactly this.
//
// Purely presentational — nothing is fetched, all data is fictional. Only the
// tab switcher and the template pills (driving the live preview) are wired.

const COMPANY = "Meridian Realty";
const WEBSITE = "meridianrealty.com";
const ACCENT = "#2563EB";

const TEMPLATES = { "classic-pro": ClassicPro, "modern-bold": ModernBold, "photo-first": PhotoFirst, "local-business": LocalBusiness, "luxury-minimal": LuxuryMinimal } as const;
type TemplateId = keyof typeof TEMPLATES;
const TEMPLATE_CHIPS: { id: TemplateId; label: string }[] = [
  { id: "classic-pro", label: "Classic Pro" }, { id: "modern-bold", label: "Modern Bold" }, { id: "photo-first", label: "Photo First" }, { id: "local-business", label: "Local Business" }, { id: "luxury-minimal", label: "Luxury Minimal" },
];

type Person = {
  id: string; name: string; title: string; initials: string; email: string;
  views: number; leads: number; lastActive: string; active: boolean; owner?: boolean;
};

// The owner's headshot (Unsplash — free for commercial use, no attribution
// required). Members render the real portal's purple-initials avatar.
const OWNER_PHOTO = "/marketing/team/person1.jpg";

const PEOPLE: Person[] = [
  { id: "alex", name: "Alex Morgan", title: "Managing Broker", initials: "AM", email: "alex@meridianrealty.com", views: 1240, leads: 128, lastActive: "2 hours ago", active: true, owner: true },
  { id: "sofia", name: "Sofia Reyes", title: "Senior Agent", initials: "SR", email: "sofia@meridianrealty.com", views: 903, leads: 94, lastActive: "Yesterday", active: true },
  { id: "marcus", name: "Marcus Lee", title: "Agent", initials: "ML", email: "marcus@meridianrealty.com", views: 588, leads: 61, lastActive: "3 days ago", active: true },
  { id: "elena", name: "Elena Diaz", title: "Agent", initials: "ED", email: "elena@meridianrealty.com", views: 511, leads: 52, lastActive: "5 days ago", active: true },
  { id: "dana", name: "Dana Ruiz", title: "Marketing Lead", initials: "DR", email: "dana@meridianrealty.com", views: 96, leads: 4, lastActive: "3 weeks ago", active: false },
];

const PENDING = { email: "priya@meridianrealty.com", initials: "PR", sent: "Jul 12" };

const LEADS = [
  { id: "l1", name: "Sarah Chen", email: "sarah@acme.com", phone: "(415) 555-0126", by: "Sofia Reyes", worked: true, label: "Contacted", when: "2 hours ago" },
  { id: "l2", name: "Marcus Webb", email: "m.webb@northgate.co", phone: null, by: "Alex Morgan", worked: false, label: "New", when: "Yesterday" },
  { id: "l3", name: "Jordan Kim", email: "jordan.kim@vela.io", phone: "(415) 555-0173", by: "Marcus Lee", worked: false, label: "New", when: "Yesterday" },
  { id: "l4", name: "Elena Diaz", email: "elena@brightpath.io", phone: "(512) 555-0180", by: "Elena Diaz", worked: true, label: "Closed", when: "4 days ago" },
  { id: "l5", name: "Tom Farrell", email: "tom@farrell.dev", phone: "(628) 555-0114", by: "Sofia Reyes", worked: true, label: "Contacted", when: "1 week ago" },
];

// Company logo mark as an SVG data URI.
function logoUri(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><rect width='48' height='48' rx='12' fill='${color}'/><text x='24' y='32' font-family='Arial' font-size='23' font-weight='700' fill='white' text-anchor='middle'>M</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

type Tab = "Team" | "Leads" | "Branding";
const TABS: Tab[] = ["Team", "Leads", "Branding"];

// Mirrors the real BigStat on /office/admin — value + optional sub + optional
// green delta arrow, explainer underneath.
function BigStat({ label, value, explainer, delta, sub }: {
  label: string; value: string; explainer: string; delta?: string; sub?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
        <p className="text-[28px] font-bold text-white tabular-nums leading-none">{value}</p>
        {sub && <span className="text-xs text-gray-600 font-medium">{sub}</span>}
        {delta && <span className="text-[11px] font-bold text-green-400">▲ {delta}</span>}
      </div>
      <p className="text-[11px] text-gray-600 mt-1.5 leading-snug">{explainer}</p>
    </div>
  );
}

// Mirrors TeamList's StatusChip tones for the statuses shown here.
function Chip({ tone, children }: { tone: "green" | "amber" | "gray"; children: React.ReactNode }) {
  const tones = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    gray: "bg-gray-800 text-gray-400 border-gray-700",
  } as const;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

// The real portal's initials avatar: purple disc, purple border.
function InitialsAvatar({ initials }: { initials: string }) {
  return (
    <span className="w-9 h-9 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-300 text-xs font-bold flex items-center justify-center shrink-0" aria-hidden="true">
      {initials}
    </span>
  );
}

const pillCls = "text-[11px] font-semibold text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full whitespace-nowrap";
const inputCls = "w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white";

// Static stand-in for a filled text input (the demo isn't a form).
function FakeInput({ value, className = "" }: { value: string; className?: string }) {
  return <div className={`${inputCls} truncate ${className}`}>{value}</div>;
}

// Mirrors OfficeBranding's numbered Section.
function Section({ n, title, desc, children }: {
  n: number; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-5 h-5 rounded-full bg-purple-500/15 text-purple-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">{n}</span>
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function TeamsDashboard() {
  const [tab, setTab] = useState<Tab>("Team");
  const [template, setTemplate] = useState<TemplateId>("classic-pro");

  const Template = TEMPLATES[template];
  const logoUrl = logoUri(ACCENT);

  // Live preview — a stand-in teammate, exactly like the real branding page:
  // their personal details are placeholders, the company half is what's set here.
  const previewData = withoutSocials({
    name: "Dana Lee",
    title: "Sales Manager",
    company: COMPANY,
    phone: "(415) 555-0100",
    email: `dana@${WEBSITE}`,
    website: WEBSITE,
    address: "660 Market St, Suite 400, San Francisco, CA, 94104",
    initials: "DL",
    logoUrl,
    cardUrl: "swiftcard.me/card/dana",
  });

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
            <div className="flex items-start justify-between gap-4 mb-1">
              <div>
                <p className="text-[17px] font-bold text-white tracking-tight">Your team</p>
                <p className="text-gray-500 text-[12px] mt-0.5">Everyone with a company card, and what those cards are bringing in.</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-500 whitespace-nowrap hidden sm:block">
                  <span className="text-gray-300 font-semibold tabular-nums">4 of 6</span> seats in use
                </span>
                <span className="bg-purple-600 text-white text-[11.5px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap">+ Add team member</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4 sm:hidden">
              <span className="text-gray-300 font-semibold tabular-nums">4 of 6</span> seats in use
            </p>

            {/* The four numbers — same as /office/admin. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 sm:mt-4">
              <BigStat label="Leads captured this month" value="339" delta="18% vs last month" explainer="People who shared their info with your team" />
              <BigStat label="Card views this month" value="3,338" delta="24% vs last month" explainer="Times someone opened one of your team's cards" />
              <BigStat label="Team activation rate" value="75%" sub="3 of 4" explainer="People you invited who have a live card up" />
              <BigStat label="Seats in use" value="4" sub="of 6" explainer="You're paying for 2 seats nobody is using" />
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-900/60 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <p className="col-span-4">Person</p>
                <p className="col-span-1 text-right">Views</p>
                <p className="col-span-1 text-right">Leads</p>
                <p className="col-span-2">Last active</p>
                <p className="col-span-2">Status</p>
                <p className="col-span-2 text-right">Actions</p>
              </div>
              <div className="divide-y divide-gray-800">
                {PEOPLE.map((p) => (
                  <div key={p.id} className="grid grid-cols-12 gap-3 px-4 py-3 items-center">
                    <div className="col-span-12 md:col-span-4 min-w-0 flex items-center gap-2.5">
                      {p.owner ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={OWNER_PHOTO} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 bg-gray-800" />
                      ) : (
                        <InitialsAvatar initials={p.initials} />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] text-white font-medium truncate">{p.name}</p>
                          {p.owner && <span className="text-[10px] text-purple-400 shrink-0">You</span>}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{p.title}</p>
                        <p className="text-[11px] text-gray-600 truncate">{p.email}</p>
                      </div>
                    </div>
                    <p className="col-span-4 md:col-span-1 text-[13px] text-gray-300 tabular-nums md:text-right"><span className="md:hidden text-gray-600 text-[10px]">Views </span>{p.views.toLocaleString("en-US")}</p>
                    <p className="col-span-4 md:col-span-1 text-[13px] text-gray-300 tabular-nums md:text-right"><span className="md:hidden text-gray-600 text-[10px]">Leads </span>{p.leads}</p>
                    <p className="col-span-4 md:col-span-2 text-[11px] text-gray-500">{p.lastActive}</p>
                    <div className="col-span-6 md:col-span-2">
                      {p.active ? <Chip tone="green">Active</Chip> : <Chip tone="amber">Not using it yet</Chip>}
                    </div>
                    <div className="col-span-6 md:col-span-2 flex md:justify-end">
                      <span className={pillCls}>Manage</span>
                    </div>
                  </div>
                ))}
                {/* Pending invites live in the same table as real people. */}
                <div className="grid grid-cols-12 gap-3 px-4 py-3 items-center">
                  <div className="col-span-12 md:col-span-4 min-w-0 flex items-center gap-2.5">
                    <InitialsAvatar initials={PENDING.initials} />
                    <div className="min-w-0">
                      <p className="text-[13px] text-gray-300 truncate">{PENDING.email}</p>
                      <p className="text-[11px] text-gray-600">Invite sent {PENDING.sent}</p>
                    </div>
                  </div>
                  <p className="col-span-4 md:col-span-1 text-[13px] text-gray-600 md:text-right">—</p>
                  <p className="col-span-4 md:col-span-1 text-[13px] text-gray-600 md:text-right">—</p>
                  <p className="col-span-4 md:col-span-2 text-[11px] text-gray-600">—</p>
                  <div className="col-span-6 md:col-span-2">
                    <Chip tone="gray">Invite sent</Chip>
                  </div>
                  <div className="col-span-6 md:col-span-2 flex items-center gap-2 md:justify-end">
                    <span className={pillCls}>Resend</span>
                    <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">Cancel</span>
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
            {/* Search + the two filter selects — same as the real LeadsTable. */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="flex-1 rounded-xl bg-gray-900 border border-gray-800 px-3 py-2 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg>
                <span className="text-gray-600 text-[12px]">Search by contact name…</span>
              </div>
              <div className="rounded-xl bg-gray-900 border border-gray-800 px-3 py-2 sm:w-48 flex items-center justify-between gap-2">
                <span className="text-gray-400 text-[12px]">Everyone on the team</span>
                <span className="text-gray-600 text-[9px]">▼</span>
              </div>
              <div className="rounded-xl bg-gray-900 border border-gray-800 px-3 py-2 sm:w-36 flex items-center justify-between gap-2">
                <span className="text-gray-400 text-[12px]">Any status</span>
                <span className="text-gray-600 text-[9px]">▼</span>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-900/60 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <p className="col-span-3">Contact</p>
                <p className="col-span-3">Email &amp; phone</p>
                <p className="col-span-2">Captured by</p>
                <p className="col-span-2">Status</p>
                <p className="col-span-2">When</p>
              </div>
              <div className="divide-y divide-gray-800">
                {LEADS.map((l) => (
                  <div key={l.id} className="grid grid-cols-12 gap-3 px-4 py-3 items-center">
                    <div className="col-span-12 md:col-span-3 min-w-0">
                      <p className="text-[13px] text-white truncate">{l.name}</p>
                    </div>
                    <div className="col-span-12 md:col-span-3 min-w-0">
                      <p className="text-[11.5px] text-gray-400 truncate">{l.email}</p>
                      <p className="text-[11.5px] text-gray-600 truncate">{l.phone || "No phone"}</p>
                    </div>
                    {/* The person's NAME — never a card URL slug. */}
                    <p className="col-span-4 md:col-span-2 text-[11.5px] text-gray-400 truncate">{l.by}</p>
                    <div className="col-span-5 md:col-span-2 flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${l.worked ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${l.worked ? "bg-green-400" : "bg-amber-400"}`} />
                        {l.label}
                      </span>
                      {!l.worked && (
                        <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">Mark contacted</span>
                      )}
                    </div>
                    <p className="col-span-3 md:col-span-2 text-[11px] text-gray-600 whitespace-nowrap">{l.when}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10.5px] text-gray-600 mt-2.5">
              <span className="text-amber-400 font-semibold">New</span> = nobody has followed up yet.{" "}
              <span className="text-green-400 font-semibold">Contacted</span>, <span className="text-green-400 font-semibold">Closed</span> and{" "}
              <span className="text-green-400 font-semibold">Not interested</span> = someone on your team has handled it.
            </p>
          </div>
        )}

        {/* ── BRANDING ── */}
        {tab === "Branding" && (
          <div>
            <div className="mb-4">
              <p className="text-[17px] font-bold text-white tracking-tight">Branding</p>
              <p className="text-gray-500 text-[12px] mt-0.5">Set this once — every card on your team automatically uses it.</p>
            </div>

            {/* The look comes from the admin's own card — same notice as the real page. */}
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl px-4 py-3 mb-4">
              <p className="text-[13px] text-purple-200 font-medium">Your own card sets the look</p>
              <p className="text-xs text-purple-200/70 mt-1 leading-relaxed">
                The colors, fonts and layout on every team card are copied from your own card —
                change your card once and everyone&apos;s updates with it.{" "}
                <span className="underline">Open your card →</span>
              </p>
            </div>

            <div className="grid md:grid-cols-[1fr_260px] gap-4 items-start">
              <div className="space-y-4 min-w-0">
                {/* 1 ── Company information */}
                <Section n={1} title="Company information" desc="What's true about your business. This is the same on everyone's card.">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-1.5">Company logo <span className="text-red-400" aria-hidden="true">*</span></p>
                      <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-700 bg-gray-950 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoUrl} alt="" className="w-11 h-11 rounded-[10px] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-300 truncate">meridian-logo.png</p>
                          <p className="text-[11px] text-gray-600">Shows on every card · <span className="text-purple-300 font-semibold">Replace</span></p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-1.5">Company name</p>
                        <FakeInput value={COMPANY} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-1.5">Website</p>
                        <FakeInput value={WEBSITE} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-1.5">Main phone number <span className="text-gray-600 font-normal">(optional)</span></p>
                        <FakeInput value="(415) 555-0100" />
                        <p className="text-[11px] text-gray-600 mt-1">Shows as &quot;Office&quot; on every card, next to each person&apos;s own number.</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-1.5">Fax <span className="text-gray-600 font-normal">(optional)</span></p>
                        <FakeInput value="(415) 555-0101" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-1.5">Business address <span className="text-gray-600 font-normal">(optional)</span></p>
                      <div className="grid grid-cols-6 gap-2">
                        <FakeInput value="660 Market St" className="col-span-4" />
                        <FakeInput value="Suite 400" className="col-span-2" />
                        <FakeInput value="San Francisco" className="col-span-3" />
                        <FakeInput value="CA" className="col-span-1" />
                        <FakeInput value="94104" className="col-span-2" />
                      </div>
                    </div>
                  </div>
                </Section>

                {/* 2 ── Card appearance */}
                <Section n={2} title="Card appearance" desc="Pick the style. The preview updates as you choose.">
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_CHIPS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplate(t.id)}
                        aria-pressed={template === t.id}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          template === t.id ? "bg-purple-600 text-white" : "bg-gray-950 text-gray-400 border border-gray-800 hover:text-gray-200"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-600 mt-3">
                    Colors and fonts come from your own card — change your card once and everyone&apos;s updates with it.
                  </p>
                </Section>

                {/* 3 ── What team members can edit */}
                <Section n={3} title="What team members can edit" desc="Everything else is locked to what you set above.">
                  <label className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-purple-500 mt-0.5" />
                    <span>
                      Keep every card matching
                      <span className="block text-[11px] text-gray-600 mt-0.5">
                        Recommended. Uncheck only if you want each person to pick their own style.
                      </span>
                    </span>
                  </label>
                </Section>

                <button type="button" className="bg-purple-600 hover:bg-purple-500 text-white text-[13px] font-semibold px-5 py-2.5 rounded-full transition-colors">
                  Save &amp; apply to all cards
                </button>
              </div>

              {/* Live preview — one stand-in teammate, like the real page. */}
              <aside>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Preview</p>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3">
                  <div className="rounded-xl overflow-hidden">
                    <CardScaler><Template data={previewData} /></CardScaler>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-2.5 leading-snug">
                    An example teammate. Their name, photo, title, phone and email are theirs — everything else is what you set here.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
