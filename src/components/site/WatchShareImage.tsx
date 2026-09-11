import { MiniQR } from "@/components/card-templates/MiniQR";
import { DEMO_HEADSHOT } from "@/components/card-templates/types";

// The Apple Watch visual — a code-rendered watch showing the REAL thing: the
// demo card's scannable QR, the way the Wallet pass and the Watch app present
// it. This replaced Apple's own press photograph (an iPhone-to-Watch NameDrop
// shot) on 2026-09-11: that image was Apple's copyright, uncredited, and it
// showed phone-to-phone sharing, which SwiftCard does not do and must never
// imply. One asset on every screen size (owner rule: phone and computer
// match). The QR is a live MiniQR, so it is genuinely scannable at 2x.
export default function WatchShareImage() {
  return (
    <div className="relative w-[236px] sm:w-[300px] select-none" aria-label="Apple Watch showing a SwiftCard QR code that says Scan to connect" role="img">
      {/* bands */}
      <div className="mx-auto w-[58%] h-16 rounded-t-[26px]" style={{ background: "linear-gradient(180deg, #2A2F3A, #171A22)" }} />
      {/* case */}
      <div className="relative mx-auto w-full aspect-[236/284] rounded-[26%] p-[9px]"
        style={{ background: "linear-gradient(160deg, #3B4150 0%, #14171E 55%, #262B36 100%)", boxShadow: "var(--rd-sh-lg), inset 0 1px 0 rgba(255,255,255,.18)" }}>
        {/* crown + side button */}
        <div className="absolute -right-[7px] top-[27%] w-[9px] h-[34px] rounded-r-md" style={{ background: "linear-gradient(90deg, #2C313C, #4A5060)" }} aria-hidden="true" />
        <div className="absolute -right-[5px] top-[50%] w-[6px] h-[54px] rounded-r-md" style={{ background: "#2C313C" }} aria-hidden="true" />
        {/* screen */}
        <div className="relative w-full h-full rounded-[22%] overflow-hidden bg-black text-white flex flex-col px-4 pt-3 pb-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[0.6875rem] font-semibold tracking-tight text-white/70">SwiftCard</span>
            <span className="text-[0.6875rem] font-semibold tabular-nums text-emerald-300">9:41</span>
          </div>
          <div className="mt-2 flex items-center gap-2 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={DEMO_HEADSHOT} alt="" width={28} height={28} className="w-7 h-7 rounded-full object-cover shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="text-[0.8125rem] font-bold truncate">Alex Morgan</p>
              <p className="text-[0.625rem] text-white/60 truncate">Realtor · Coastline Realty</p>
            </div>
          </div>
          <div className="mt-2.5 flex-1 flex items-center justify-center">
            <div className="bg-white rounded-[10px] p-1.5">
              <MiniQR size={92} url="https://swiftcard.me/alexmorgan" fg="#0E1017" />
            </div>
          </div>
          <p className="mt-2 text-center text-[0.625rem] font-semibold tracking-wide text-white/75">Scan to connect</p>
        </div>
      </div>
      <div className="mx-auto w-[58%] h-16 rounded-b-[26px]" style={{ background: "linear-gradient(180deg, #171A22, #2A2F3A)" }} />
      {/* floor */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 w-[70%] h-6 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(37,99,235,.35), transparent)" }} aria-hidden="true" />
    </div>
  );
}
