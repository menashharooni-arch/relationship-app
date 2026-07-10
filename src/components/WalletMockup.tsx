import { SAMPLE_DATA } from "@/components/card-templates/types";

// Apple-Wallet-style mockup: the real SwiftCard pass sits on top; beneath it are
// clearly-FICTIONAL example payment cards, each explicitly labelled "EXAMPLE"
// with obviously-fake numbers. The point is to show SwiftCard living alongside
// the cards people already keep in Wallet — WITHOUT implying any real financial
// data. No real card numbers, issuers, or accounts appear anywhere.

const EXAMPLE_CARDS = [
  { name: "Everyday Card", tail: "1234", grad: "linear-gradient(135deg,#334155,#0f172a)", top: 96 },
  { name: "Travel Rewards", tail: "5678", grad: "linear-gradient(135deg,#7c3aed,#4338ca)", top: 132 },
  { name: "Cashback Card", tail: "9012", grad: "linear-gradient(135deg,#0f766e,#065f46)", top: 168 },
];

export default function WalletMockup() {
  return (
    <div className="mx-auto w-full max-w-[360px]">
      {/* SwiftCard pass — the real one */}
      <div
        className="relative rounded-[22px] p-5 text-white shadow-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg,#1D4ED8 0%,#2745c9 55%,#4f46e5 100%)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wallet/icon@2x.png" alt="" width={26} height={26} className="rounded-md" aria-hidden />
            <span className="font-bold tracking-tight text-sm">SwiftCard</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Contact Pass</span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo/avatar.svg" alt="Sample avatar" className="w-12 h-12 rounded-full object-cover ring-2 ring-white/40" style={{ background: "#e9eefc" }} />
          <div className="min-w-0">
            <p className="font-bold text-base leading-tight">{SAMPLE_DATA.name}</p>
            <p className="text-white/75 text-xs">{SAMPLE_DATA.title} · {SAMPLE_DATA.company}</p>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/60">Tap or scan to save</p>
            <p className="text-xs font-semibold mt-0.5">swiftcard.me/card/alexmorgan</p>
          </div>
          {/* Faux barcode strip — decorative, not a scannable code */}
          <div className="flex items-end gap-[2px] h-8" aria-hidden>
            {[6, 3, 8, 4, 7, 2, 8, 5, 3, 7, 4, 8, 2, 6].map((h, i) => (
              <span key={i} className="w-[3px] rounded-sm bg-white/85" style={{ height: `${h * 3 + 8}px` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Example payment cards — stacked below like Apple Wallet, clearly fake */}
      <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-slate-400 mt-6 mb-3">
        Example cards — illustration only
      </p>
      <div className="relative" style={{ height: 236 }}>
        {EXAMPLE_CARDS.map((c, i) => (
          <div
            key={c.name}
            className="absolute left-0 right-0 rounded-[20px] p-4 text-white shadow-xl"
            style={{ background: c.grad, top: c.top - 96, zIndex: i, height: 150 }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/20 border border-white/30">
                Example
              </span>
              <span className="text-xs font-semibold text-white/80">{c.name}</span>
            </div>
            <p className="mt-6 font-mono text-sm tracking-[0.2em] text-white/90">•••• •••• •••• {c.tail}</p>
            <p className="mt-3 text-[10px] text-white/60">Sample card — not a real account or number</p>
          </div>
        ))}
      </div>
    </div>
  );
}
