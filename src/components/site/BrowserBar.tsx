// Safari-style address bar drawn above a demo phone screen.
//
// This exists to answer one objection, visually: "does the person I hand my
// card to need to download something?" Ten sentences across the site say no.
// A browser chrome says it without a sentence — an address bar is the one
// piece of furniture nobody mistakes for an app. It is the reason the hero
// phone reads as "their browser" and not "our app".
//
// Deliberately understated: real Safari furniture (aA, lock, URL, reload) at
// low contrast, so it registers as a browser and then gets out of the way of
// the card, which is the thing being sold.

// iOS status bar. Lives here with the address bar because the two are one
// piece of furniture: the browser bar needs the status row above it to clear
// the phone's dynamic island, and a URL half-hidden behind the island is
// exactly the detail that makes a mock read as fake.
export function PhoneStatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold text-slate-800">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <svg viewBox="0 0 18 12" className="w-4 h-3" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1" /><rect x="5" y="4" width="3" height="8" rx="1" /><rect x="10" y="1" width="3" height="11" rx="1" opacity="0.4" /></svg>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12 18a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM5 13a10 10 0 0114 0l-1.5 1.5a8 8 0 00-11 0zm-3-3a14 14 0 0120 0l-1.5 1.5a12 12 0 00-17 0z" /></svg>
        <svg viewBox="0 0 26 13" className="w-6 h-3.5" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="22" height="12" rx="3" /><rect x="2" y="2" width="17" height="9" rx="1.5" fill="currentColor" /><rect x="23.5" y="4" width="2" height="5" rx="1" fill="currentColor" /></svg>
      </div>
    </div>
  );
}

export default function BrowserBar({ url = "swiftcard.me/card/alexmorgan" }: { url?: string }) {
  return (
    <div
      className="px-3 pt-1 pb-2"
      style={{ background: "#F7F5F1", borderBottom: "1px solid rgba(15,23,42,0.08)" }}
    >
      <div
        className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5"
        style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.07)" }}
      >
        <span className="text-[11px] font-semibold leading-none shrink-0" style={{ color: "#8C8880" }} aria-hidden>
          aA
        </span>

        {/* Lock — drawn, not a glyph, so it keeps the same stroke as the rest. */}
        <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="#8C8880" strokeWidth={2.2} aria-hidden>
          <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
          <path d="M8 10.5V7.5a4 4 0 118 0v3" strokeLinecap="round" />
        </svg>

        <span className="text-[12px] leading-none truncate" style={{ color: "#5C5852" }}>
          {url}
        </span>

        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0 ml-auto" fill="none" stroke="#8C8880" strokeWidth={2.2} aria-hidden>
          <path d="M20 11a8 8 0 10-2.3 5.7" strokeLinecap="round" />
          <path d="M20 5.5V11h-5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
