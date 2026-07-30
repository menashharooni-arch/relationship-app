"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CardData } from "@/components/card-templates/types";
import { withoutSocials } from "@/components/card-templates/types";
import DownloadCardButton from "@/components/DownloadCardButton";

const ClassicPro    = dynamic(() => import("@/components/card-templates/ClassicPro"),    { ssr: false });
const ModernBold    = dynamic(() => import("@/components/card-templates/ModernBold"),    { ssr: false });
const PhotoFirst    = dynamic(() => import("@/components/card-templates/PhotoFirst"),    { ssr: false });
const LocalBusiness = dynamic(() => import("@/components/card-templates/LocalBusiness"), { ssr: false });
const LuxuryMinimal = dynamic(() => import("@/components/card-templates/LuxuryMinimal"), { ssr: false });
const CustomCard    = dynamic(() => import("@/components/card-templates/CustomCard"),    { ssr: false });

const TEMPLATE_MAP: Record<string, React.ComponentType<{ data: CardData }>> = {
  "classic-pro":    ClassicPro,
  "modern-bold":    ModernBold,
  "photo-first":    PhotoFirst,
  "local-business": LocalBusiness,
  "luxury-minimal": LuxuryMinimal,
  "custom":         CustomCard,
};

// Templates are laid out for roughly this width; we render at it and scale to fit
// the container so nothing (text, QR) gets clipped in narrow columns. Kept a touch
// wider than the public card (max-w-sm ≈ 384px) so the fixed-height card has enough
// vertical room for the QR + all contact rows.
const NATURAL = 460;

interface Props {
  data: CardData;
  template: string;
  username: string;
  previewUrl?: string;
}

export default function CardPreviewDownload({ data, template, username, previewUrl }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [height, setHeight] = useState(0);
  const Template = TEMPLATE_MAP[template] ?? ClassicPro;

  useEffect(() => {
    function recompute() {
      const w = outerRef.current?.clientWidth ?? NATURAL;
      const s = w / NATURAL;
      const naturalH = cardRef.current?.offsetHeight ?? Math.round(NATURAL / 1.75);
      setScale(s);
      setHeight(naturalH * s);
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    if (outerRef.current) ro.observe(outerRef.current);
    if (cardRef.current) ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [data, template]);

  return (
    <div>
      <div
        ref={outerRef}
        className="w-full rounded-xl overflow-hidden"
        style={{ height: height || undefined }}
      >
        <div
          ref={cardRef}
          className="pointer-events-none"
          style={{
            width: NATURAL,
            transform: scale ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
            opacity: scale ? 1 : 0,
          }}
        >
          <Template data={template === "custom" ? data : withoutSocials(data)} />
        </div>
      </div>

      {/* NO "Preview" link here. It was removed on purpose (2026-07-10) and
          replaced by the "View live card" button in the dashboard header —
          two controls opening the same URL side by side was the thing being
          fixed. `previewUrl` survives ONLY because DownloadCardButton needs it
          as the native share target: inside the iOS shell WKWebView can't save
          a generated PNG, so it shares this link instead of dead-tapping.
          Passing the prop must never resurrect the link — that regression is
          exactly what happened once and is now pinned by a test. */}
      <div className="mt-3">
        <DownloadCardButton cardRef={cardRef} filename={`swiftcard-${username}.png`} compact shareUrl={previewUrl} />
      </div>
    </div>
  );
}
