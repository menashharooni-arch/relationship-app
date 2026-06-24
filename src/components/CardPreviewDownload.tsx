"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import type { CardData } from "@/components/card-templates/types";
import DownloadCardButton from "@/components/DownloadCardButton";

const ClassicPro    = dynamic(() => import("@/components/card-templates/ClassicPro"),    { ssr: false });
const ModernBold    = dynamic(() => import("@/components/card-templates/ModernBold"),    { ssr: false });
const PhotoFirst    = dynamic(() => import("@/components/card-templates/PhotoFirst"),    { ssr: false });
const LocalBusiness = dynamic(() => import("@/components/card-templates/LocalBusiness"), { ssr: false });
const LuxuryMinimal = dynamic(() => import("@/components/card-templates/LuxuryMinimal"), { ssr: false });

const TEMPLATE_MAP: Record<string, React.ComponentType<{ data: CardData }>> = {
  "classic-pro":    ClassicPro,
  "modern-bold":    ModernBold,
  "photo-first":    PhotoFirst,
  "local-business": LocalBusiness,
  "luxury-minimal": LuxuryMinimal,
};

interface Props {
  data: CardData;
  template: string;
  username: string;
}

export default function CardPreviewDownload({ data, template, username }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const Template = TEMPLATE_MAP[template] ?? ClassicPro;

  return (
    <div>
      <div ref={cardRef} className="w-full pointer-events-none rounded-xl overflow-hidden">
        <Template data={data} />
      </div>
      <div className="mt-3">
        <DownloadCardButton cardRef={cardRef} filename={`swiftcard-${username}.png`} />
      </div>
    </div>
  );
}
