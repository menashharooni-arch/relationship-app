import PhoneFrame from "@/components/PhoneFrame";
import PreviewClient from "@/app/preview/PreviewClient";

// "How your dashboard looks" — the REAL demo dashboard (PreviewClient, the same
// component embedded elsewhere on the landing) rendered inside a phone. The
// inner area scrolls on its own (overscroll-contain) so you can explore the
// dashboard without the page scrolling underneath. Fully interactive: switch
// cards, flip contact views, open live previews — nothing is a static image.
export default function DashboardPhonePreview({ width = 340 }: { width?: number }) {
  return (
    <PhoneFrame
      width={width}
      ariaLabel="Interactive preview of the SwiftCard dashboard on a phone"
      screenStyle={{ height: "min(660px, 76vh)", background: "#030712" }}
    >
      <div className="flex flex-col h-full">
        {/* App status strip */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-3 pb-2 text-[11px] text-gray-400 bg-gray-950 border-b border-gray-800/70">
          <span className="font-semibold text-white">SwiftCard</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Live · scroll inside
          </span>
        </div>
        {/* Scroll-contained real dashboard */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-1 pb-6">
            <PreviewClient embedded />
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
