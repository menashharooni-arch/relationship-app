import { MiniQR } from "@/components/card-templates/types";

// Apple Watch card face — a tappable business card on the wrist.
// The homepage copy is honest that native watchOS support is on the roadmap.
export default function WatchScene() {
  return (
    <div className="relative mx-auto w-[230px]">
      <div className="rd-glow rd-glow-cyan rd-drift-b" style={{ width: 260, height: 260, left: "-10%", top: "-6%", opacity: 0.4 }} />
      {/* watch body */}
      <div className="relative mx-auto w-[200px] h-[240px] rounded-[54px] p-[10px] shadow-2xl" style={{ background: "linear-gradient(160deg,#2a2f3d,#0c0e14)", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
        {/* crown */}
        <div className="absolute -right-[6px] top-[74px] w-[6px] h-[34px] rounded-r-md" style={{ background: "#3a4152" }} />
        <div className="absolute -right-[5px] top-[118px] w-[5px] h-[26px] rounded-r-md" style={{ background: "#2c3140" }} />
        {/* screen */}
        <div className="w-full h-full rounded-[44px] overflow-hidden relative" style={{ background: "linear-gradient(160deg,#5D6BFF,#22D3EE)" }}>
          <div className="absolute inset-0 opacity-25" style={{ background: "radial-gradient(120% 90% at 30% -10%, rgba(255,255,255,0.6), transparent 55%)" }} />
          <div className="relative h-full flex flex-col items-center justify-between p-4 text-center">
            <div className="w-full flex items-center justify-between text-white/85 text-[10px] font-semibold">
              <span>10:09</span>
              <span>􀋦</span>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto rounded-full overflow-hidden border-2 border-white/70 mb-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/demo/headshot.jpg" alt="Alex Morgan" className="w-full h-full object-cover" />
              </div>
              <p className="text-white text-[14px] font-extrabold leading-tight">Alex Morgan</p>
              <p className="text-white/80 text-[10px]">Tap to share</p>
            </div>
            <div className="rounded-lg bg-white p-1">
              <MiniQR size={40} url="https://swiftcard.me/card/alexmorgan" fg="#0E1017" />
            </div>
          </div>
        </div>
      </div>
      {/* band hint */}
      <div className="mx-auto w-[120px] h-[26px] -mt-1 rounded-b-2xl" style={{ background: "linear-gradient(#e7c9a0,#d9b98c)" }} />
    </div>
  );
}
