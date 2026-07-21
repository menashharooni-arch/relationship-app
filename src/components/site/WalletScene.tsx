import { MiniQR } from "@/components/card-templates/MiniQR";

// Apple Wallet-style stack: a SwiftCard pass on top, with clearly fictional
// cards tucked underneath. No real card numbers — purely illustrative.

const FAKE_CARDS = [
  { name: "Everyday", grad: "linear-gradient(120deg,#2b2f45,#3d4468)", tail: "0007" },
  { name: "Travel", grad: "linear-gradient(120deg,#1f5f5b,#2f8f86)", tail: "4412" },
  { name: "Rewards", grad: "linear-gradient(120deg,#5a2f6b,#8a4fa0)", tail: "9930" },
];

export default function WalletScene() {
  return (
    <div className="rd-phone w-[300px] mx-auto">
      <div className="rd-phone-screen h-[600px]" style={{ background: "#05060A" }}>
        <div className="rd-notch" />
        <div className="absolute inset-0 px-4 pt-12 pb-6 flex flex-col">
          <p className="text-white text-[22px] font-bold tracking-tight mb-4">Wallet</p>

          {/* SwiftCard pass — on top */}
          <div className="relative rounded-[22px] overflow-hidden shadow-2xl z-30" style={{ background: "linear-gradient(120deg,#7A5CFF,#4C7DFF 55%,#22D3EE)" }}>
            <div className="absolute inset-0 opacity-25" style={{ background: "radial-gradient(120% 100% at 20% -10%, rgba(255,255,255,0.6), transparent 55%)" }} />
            <div className="relative p-4">
              <div className="flex items-center justify-between">
                <span className="text-white/90 text-[11px] font-bold tracking-[0.18em] uppercase">SwiftCard</span>
                <span className="text-white/80 text-[11px] font-semibold">Coastline Realty</span>
              </div>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="text-white text-[18px] font-extrabold leading-tight">Alex Morgan</p>
                  <p className="text-white/80 text-[12px]">Realtor®</p>
                </div>
                <div className="rounded-lg bg-white p-1.5">
                  <MiniQR size={44} url="https://swiftcard.me/card/alexmorgan" fg="#0E1017" />
                </div>
              </div>
            </div>
          </div>

          {/* Fictional cards tucked underneath (peeking top edges) */}
          <div className="relative -mt-3">
            {FAKE_CARDS.map((c, i) => (
              <div
                key={c.name}
                className="rounded-[22px] px-4 pt-3 shadow-xl border border-white/5"
                style={{ background: c.grad, marginTop: i === 0 ? 0 : -64, height: 84, zIndex: 20 - i }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white/90 text-[12px] font-semibold">{c.name}</span>
                  <span className="text-white/50 text-[11px]">•••• {c.tail}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-center gap-2 text-white/40 text-[11px]">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17 4a5 5 0 00-5 3 5 5 0 00-9 3c0 4 5 7 9 9 4-2 9-5 9-9a5 5 0 00-4-6z" opacity="0.5" /></svg>
            Illustrative cards — not real accounts
          </div>
        </div>
      </div>
    </div>
  );
}
