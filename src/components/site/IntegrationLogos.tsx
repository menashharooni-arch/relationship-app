// Real brand marks for the CRM / integrations SwiftCard connects to — Zapier,
// Google Contacts, HubSpot, and CSV export. Rendered as light pills so the
// colorful logos read on a dark section. Shared by the homepage integrations
// band and the Integrations product page.

const ITEMS: { name: string; logo: React.ReactNode }[] = [
  {
    name: "Zapier",
    logo: (
      <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="#FF4F00" strokeWidth={3.2} strokeLinecap="round"><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5" /></svg>
    ),
  },
  {
    name: "Google Contacts",
    logo: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" /><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0024 46z" /><path fill="#FBBC05" d="M11.69 28.18A13.2 13.2 0 0111 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 002 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" /><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2A21.99 21.99 0 004.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z" /></svg>
    ),
  },
  {
    name: "HubSpot",
    logo: (
      <svg viewBox="0 0 24 24" className="w-full h-full" fill="#FF7A59"><path d="M18.5 7.3V4.9a1.85 1.85 0 10-1.1 0v2.4a5.6 5.6 0 00-2.66 1.17L8.2 4.02a2.1 2.1 0 10-1 1.72l6.42 4.42a5.6 5.6 0 00.02 6.06l-1.95 1.95a1.8 1.8 0 101.06 1.06l1.93-1.93A5.62 5.62 0 1018.5 7.3zm-2.16 8.42a2.9 2.9 0 112.9-2.9 2.9 2.9 0 01-2.9 2.9z" /></svg>
    ),
  },
  {
    name: "CSV Export",
    logo: (
      <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="#5D6BFF" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M13 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9z" /><path d="M13 3v6h6" /><path d="M8.5 13.5h7M8.5 16.5h7" /></svg>
    ),
  },
];

export default function IntegrationLogos() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
      {ITEMS.map((it) => (
        <div key={it.name} className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-[0_14px_36px_-18px_rgba(0,0,0,0.6)]">
          <span className="w-7 h-7 flex items-center justify-center shrink-0">{it.logo}</span>
          <span className="text-slate-800 text-[14px] font-semibold whitespace-nowrap">{it.name}</span>
        </div>
      ))}
    </div>
  );
}
