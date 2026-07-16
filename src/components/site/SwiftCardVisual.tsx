import { MiniQR } from "@/components/card-templates/MiniQR";

// A premium, self-contained SwiftCard face used across the marketing site.
// Modeled on the real product card; a real scannable MiniQR keeps it authentic.
// Fully presentational — safe to render anywhere, no data fetching.

type Props = {
  name?: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
  accent?: string;
  photoUrl?: string | null;
  initials?: string;
  qrUrl?: string;
  className?: string;
};

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(15,23,42,0.05)" }}>{icon}</span>
      <span className="text-[13px] text-slate-600 truncate">{children}</span>
    </div>
  );
}

export default function SwiftCardVisual({
  name = "Alex Morgan",
  title = "Founder & Principal",
  company = "Coastline Realty",
  phone = "(415) 555-0188",
  email = "alex@coastlinerealty.com",
  website = "coastlinehomes.com",
  accent = "#5D6BFF",
  photoUrl = "/marketing/demo-girl.jpg",
  initials = "AM",
  qrUrl = "https://swiftcard.me/card/alexmorgan",
  className = "",
}: Props) {
  const accent2 = "#22D3EE";
  return (
    <div
      className={`relative w-full overflow-hidden bg-white ${className}`}
      style={{ borderRadius: 24, boxShadow: "0 30px 70px -30px rgba(8,10,18,0.55), 0 2px 8px rgba(8,10,18,0.08)" }}
    >
      {/* Accent header */}
      <div className="relative h-[92px]" style={{ background: `linear-gradient(120deg, ${accent}, ${accent2})` }}>
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(120% 120% at 20% -20%, rgba(255,255,255,0.5), transparent 55%)" }} />
        <div className="absolute top-3.5 left-4 right-4 flex items-center justify-between">
          <span className="text-white/90 text-[10px] font-bold tracking-[0.18em] uppercase">SwiftCard</span>
          <span className="text-white/80 text-[10px] font-semibold">{company}</span>
        </div>
      </div>

      <div className="px-5 pb-5">
        {/* Avatar overlapping the header */}
        <div className="-mt-10 mb-3 flex items-end justify-between">
          <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden border-[3px] border-white shadow-md bg-slate-100 flex items-center justify-center">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[22px] font-black" style={{ color: accent }}>{initials}</span>
            )}
          </div>
          <div className="mb-1 rounded-xl bg-white p-1.5 shadow-sm border border-slate-100">
            <MiniQR size={48} url={qrUrl} fg="#0E1017" />
          </div>
        </div>

        <p className="text-[19px] font-extrabold text-slate-900 leading-tight tracking-tight">{name}</p>
        <p className="text-[13px] font-medium" style={{ color: accent }}>{title}</p>

        <div className="mt-4 space-y-2">
          <Row icon={<svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke={accent} strokeWidth={1.9}><path d="M3 5.5C3 4.7 3.7 4 4.5 4h2.6a1 1 0 01.95.68l1 3a1 1 0 01-.5 1.2l-1.3.65a12 12 0 005.5 5.5l.65-1.3a1 1 0 011.2-.5l3 1a1 1 0 01.68.95v2.6c0 .8-.7 1.5-1.5 1.5A16.5 16.5 0 013 5.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>}>{phone}</Row>
          <Row icon={<svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke={accent} strokeWidth={1.9}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 5 8-5" strokeLinecap="round" strokeLinejoin="round" /></svg>}>{email}</Row>
          <Row icon={<svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke={accent} strokeWidth={1.9}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" /></svg>}>{website}</Row>
        </div>

        {/* Save contact */}
        <div className="mt-5 flex items-center justify-center gap-2 rounded-full py-2.5 text-white text-[13px] font-bold" style={{ background: accent, boxShadow: `0 8px 20px -8px ${accent}` }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21v-8H5v8M5 3h11l3 3v3M9 3v4h6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Save Contact
        </div>
      </div>
    </div>
  );
}
