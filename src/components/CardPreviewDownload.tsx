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

      <div className="mt-3 flex items-center gap-2">
        <DownloadCardButton cardRef={cardRef} filename={`swiftcard-${username}.png`} compact />
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full py-2 transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M6.75 1a.75.75 0 01.75.75V3h1V1.75a.75.75 0 011.5 0V3H11a2 2 0 012 2v7.5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h1.25V1.75A.75.75 0 016.75 1zM5 4.5a.5.5 0 00-.5.5v7.5a.5.5 0 00.5.5h6a.5.5 0 00.5-.5V5a.5.5 0 00-.5-.5H5z" /></svg>
            Preview
          </a>
        )}
      </div>
    </div>
  );
}
