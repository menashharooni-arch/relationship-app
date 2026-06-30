import Link from "next/link";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import ClassicPro from "@/components/card-templates/ClassicPro";
import { SAMPLE_DATA, withoutSocials } from "@/components/card-templates/types";

export const metadata = {
  title: "Dashboard preview — SwiftCard",
  description: "See exactly what your SwiftCard dashboard looks like — cards, traffic, leads, and follow-ups in one place.",
};

type Lead = { name: string; initial: string; source: string; color: string; msg: string; status: "New Contact" | "Touch" | "Dissolved"; time: string };

const LEADS: Lead[] = [
  { name: "Sarah Chen",   initial: "S", source: "LinkedIn",   color: "#0A66C2", msg: "Loved your pitch at the expo — let's set up a call this week!", status: "New Contact", time: "2m ago" },
  { name: "Marcus Webb",  initial: "M", source: "QR Code",    color: "#1D4ED8", msg: "Following up on the Maple St listing, is it still available?", status: "Touch",       time: "1h ago" },
  { name: "Priya Patel",  initial: "P", source: "Instagram",  color: "#E1306C", msg: "Hi! Saw your card — I'd love a demo for my team.", status: "New Contact", time: "3h ago" },
  { name: "David Kim",    initial: "D", source: "NFC Tap",    color: "#7C3AED", msg: "Thanks for the info, I'll be in touch soon.", status: "Touch", time: "Yesterday" },
  { name: "Elena Ruiz",   initial: "E", source: "Website",    color: "#0EA5E9", msg: "Can you send over pricing and availability for next month?", status: "New Contact", time: "Yesterday" },
  { name: "James Carter", initial: "J", source: "Share Link", color: "#10B981", msg: "Great meeting you at the conference — connecting now.", status: "Dissolved", time: "2d ago" },
];

const STATUS_STYLE: Record<Lead["status"], { bg: string; text: string }> = {
  "New Contact": { bg: "rgba(59,130,246,0.15)", text: "#93c5fd" },
  "Touch":       { bg: "rgba(245,158,11,0.15)", text: "#fcd34d" },
  "Dissolved":   { bg: "rgba(107,114,128,0.18)", text: "#9ca3af" },
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-gray-900 border border-gray-800/80 rounded-2xl p-5 ${className}`}>{children}</div>;
}

export default function PreviewPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SwiftCardLogo size={26} wordmark={false} onDark />
            <span className="font-bold text-sm">SwiftCard</span>
            <span className="text-gray-600 text-xs hidden sm:inline">· Dashboard preview</span>
          </div>
          <Link href="/join" className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors">
            Start free →
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-7">
        <div className="mb-6">
          <h1 className="text-xl font-bold">This is your dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">A real look at everything you manage from one place — sample data shown.</p>
        </div>

        {/* My Cards */}
        <Card className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white font-semibold text-sm">My Cards</p>
              <p className="text-gray-600 text-xs mt-0.5">Check a card to view everything about it. Only one card can be selected at a time.</p>
            </div>
            <span className="text-xs text-blue-400 font-medium">+ Add card</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Sales Card", handle: "alex-sales", name: "Alex Morgan", active: true },
              { label: "Real Estate", handle: "alex-realty", name: "Alex Morgan", active: false },
            ].map((c) => (
              <div key={c.handle} className={`flex items-center gap-3 rounded-xl px-4 py-3 border flex-1 min-w-full sm:min-w-[220px] ${c.active ? "bg-blue-600/10 border-blue-600/40" : "bg-gray-800/60 border-gray-700/60"}`}>
                <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 ${c.active ? "bg-blue-600 border-blue-600" : "border-gray-600"}`}>
                  {c.active && <svg viewBox="0 0 20 20" fill="white" className="w-3 h-3"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" /></svg>}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${c.active ? "bg-blue-600/30 border border-blue-500/40 text-blue-300" : "bg-gray-700 text-gray-400"}`}>{c.label[0]}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{c.label}</p>
                  <p className="text-gray-500 text-xs truncate">/{c.handle} · {c.name}</p>
                </div>
                <span className="text-xs text-gray-500 shrink-0 pl-2 border-l border-gray-700/60">Edit</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top row: Traffic + Swift Links + Email signature */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.85fr_0.72fr_0.7fr] gap-4 mb-5">
          {/* Traffic */}
          <Card>
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
                { label: "SwiftCard Views", sub: "from your business card link", value: "1,248" },
                { label: "SwiftLink Views", sub: "from your Swift Links page", value: "593" },
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
          </Card>

          {/* Swift Links */}
          <Card>
            <p className="text-gray-600 text-[11px] mb-2 leading-relaxed">Your bio, socials, and links in one place — drop it in any bio.</p>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Swift Links</p>
            <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5">
              <span className="text-blue-400 text-xs truncate flex-1">swiftcard.me/links/alex-sales</span>
            </div>
            <div className="mt-2 block text-center text-xs font-semibold text-gray-400 bg-gray-800 border border-gray-700 rounded-full py-2">Open Swift Links →</div>
          </Card>

          {/* Email signature */}
          <Card>
            <p className="text-white font-semibold text-sm">Email signature</p>
            <p className="text-gray-500 text-[11px] mt-1 leading-relaxed">Copy and use this as your email signature — a clickable link to your card.</p>
            <div className="mt-3 w-full bg-blue-600 text-white font-semibold text-xs py-2 rounded-full text-center">Preview &amp; copy</div>
          </Card>
        </div>

        {/* Main: contacts + card panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          {/* Contacts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-white font-semibold text-sm">Contacts</h2>
                <span className="text-white font-bold text-lg tabular-nums">87</span>
                <span className="text-gray-500 text-[11px] font-medium">Total leads</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg">+ Add contact</span>
                <span className="text-xs text-gray-500 border border-gray-800 px-3 py-1.5 rounded-lg">Export</span>
              </div>
            </div>

            {/* Filters */}
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

            {/* Lead list */}
            <div className="space-y-2">
              {LEADS.map((l) => (
                <div key={l.name} className="bg-gray-900 border border-gray-800/80 rounded-2xl px-4 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white" style={{ background: l.color }}>{l.initial}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-semibold truncate">{l.name}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: l.color + "22", color: l.color }}>{l.source}</span>
                    </div>
                    <p className="text-gray-500 text-xs truncate mt-0.5">{l.msg}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: STATUS_STYLE[l.status].bg, color: STATUS_STYLE[l.status].text }}>{l.status}</span>
                    <span className="text-gray-600 text-[10px]">{l.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Your Card + Share */}
          <div className="flex flex-col gap-4">
            <Card>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-4">Your Card</p>
              <div style={{ height: "210px", overflow: "hidden", borderRadius: "12px" }}>
                <div style={{ width: "390px", transform: "scale(0.69)", transformOrigin: "top left" }}>
                  <ClassicPro data={withoutSocials(SAMPLE_DATA)} />
                </div>
              </div>
            </Card>
            <Card className="space-y-2">
              <div className="w-full bg-blue-600 text-white font-semibold text-sm py-2.5 rounded-full text-center">Share</div>
              <div className="w-full text-gray-400 text-xs py-2 rounded-full text-center border border-gray-800">More ways to share</div>
            </Card>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <p className="text-gray-400 text-sm mb-3">Your dashboard, ready in under a minute.</p>
          <Link href="/join" className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-full transition-colors">
            Create your free card →
          </Link>
        </div>
      </div>
    </main>
  );
}
