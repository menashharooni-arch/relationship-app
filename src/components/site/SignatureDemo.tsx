import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import { withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";

// Email Signature showcase: a realistic (wide) email whose signature is the REAL
// SwiftCard — the actual ClassicPro template rendered exactly as we ship it.
// Clicking the signature opens a real SwiftCard link (/card/demo-realty), so it
// behaves and looks identical to what a recipient really gets.

// Matches the live demo card at /card/demo-realty so the signature and the card
// it opens are the same person.
const CARD_DATA: CardData = withoutSocials({
  name: "Alex Morgan",
  title: "Realtor",
  company: "Coastline Realty",
  phone: "(415) 555-0188",
  email: "alex@coastlinerealty.com",
  website: "coastlinehomes.com",
  initials: "AM",
  photoUrl: null,
  logoUrl: null,
  cardUrl: "swiftcard.me/card/demo-realty",
});

const CARD_HREF = "/card/demo-realty";

export default function SignatureDemo() {
  return (
    <div>
      {/* Works everywhere */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8" data-reveal="fade">
        <span className="text-slate-500 text-[15px] font-medium">Works on all platforms —</span>
        {["Gmail", "Outlook", "Yahoo", "Hotmail", "Apple Mail"].map((p) => (
          <span key={p} className="rd-pill rd-pill-l text-[13px]">{p}</span>
        ))}
        <span className="text-slate-500 text-[15px] font-medium">all of it.</span>
      </div>

      {/* Wide email mockup */}
      <div className="rd-card-l overflow-hidden max-w-3xl mx-auto" data-reveal="scale">
        {/* window chrome */}
        <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-100 bg-slate-50">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[12px] text-slate-400 font-medium">New Message</span>
        </div>
        <div className="p-6 sm:p-8 text-slate-700">
          <div className="text-[13px] space-y-1.5 pb-3 border-b border-slate-100">
            <p><span className="text-slate-400">To:</span> sarah@acme.com</p>
            <p><span className="text-slate-400">Subject:</span> Great connecting today</p>
          </div>
          <div className="pt-5 text-[14.5px] leading-relaxed space-y-3">
            <p>Hi Sarah,</p>
            <p>Really enjoyed chatting earlier. My details are in my signature below — feel free to reach out anytime.</p>
            <p>Best,</p>
          </div>

          {/* signature */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            {/* hint above the signature */}
            <p className="text-[13px] font-semibold mb-3 flex items-center gap-1.5" style={{ color: "#2563EB" }}>
              Click the signature and see what happens
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M12 19l-4-4M12 19l4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </p>

            <p className="text-[14px] text-slate-900 mb-2"><strong>Alex Morgan</strong> <span className="text-slate-500">| Coastline Realty</span></p>
            {/* Real ClassicPro card. The card's own contact links are disabled
                (pointer-events:none) and a single overlay link sits on top, so the
                whole card opens the SwiftCard without nesting anchors. */}
            <div className="group relative w-[360px] max-w-full transition-transform hover:-translate-y-0.5">
              <div className="rounded-xl overflow-hidden shadow-[0_10px_30px_-14px_rgba(8,10,18,0.4)]" style={{ pointerEvents: "none", background: "#FAF7F2" }}>
                <CardScaler><ClassicPro data={CARD_DATA} /></CardScaler>
              </div>
              <a
                href={CARD_HREF}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Alex Morgan's SwiftCard"
                className="absolute inset-0 z-10 rounded-xl"
              />
              <span className="absolute -top-2 -right-2 z-20 rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow-lg pointer-events-none" style={{ background: "var(--rd-aurora)" }}>Clickable ↗</span>
            </div>
            <a href={CARD_HREF} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[14px] font-bold no-underline" style={{ color: "#2563eb" }}>Contact me →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
