"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CardScaler from "@/components/CardScaler";
import InertPreview from "@/components/InertPreview";
import ImageUpload from "@/components/ImageUpload";
import LogoSuggest from "@/components/LogoSuggest";
import ProfilePhotoSuggest from "@/components/ProfilePhotoSuggest";
import TemplateStyleControls from "@/components/card-templates/TemplateStyleControls";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import type { CardData } from "@/components/card-templates/types";
import MiniBuilderModal, { type MiniStep } from "./MiniBuilderModal";
import { useProductSketch } from "./useProductSketch";
import { Field } from "./BuilderFields";

// The 6th tile in the Swift Cards template grid: a dashed card outline with a
// "+" that opens the REAL card builder — the same controls the signed-in editor
// uses (TemplateStyleControls for colours/fonts, ImageUpload for the cropped
// headshot/logo, LogoSuggest + ProfilePhotoSuggest for the automatic
// suggestions), just scoped to what a digital card actually renders.
//
// Everything a visitor does here survives into /cards/new and, from there, into
// their account — see useProductSketch → CardPrefill.

const TEMPLATES = [
  { id: "classic-pro", label: "Classic", Component: ClassicPro },
  { id: "modern-bold", label: "Modern", Component: ModernBold },
  { id: "photo-first", label: "Photo", Component: PhotoFirst },
  { id: "local-business", label: "Local", Component: LocalBusiness },
  { id: "luxury-minimal", label: "Luxury", Component: LuxuryMinimal },
];

export default function CardMiniBuilder({ linkedinEnabled = false }: { linkedinEnabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const { sketch, patch, patchStyle, handOff, reset } = useProductSketch("card", open);

  const Preview = TEMPLATES.find((t) => t.id === sketch.template)?.Component ?? ClassicPro;
  const addressStr = [
    sketch.street,
    sketch.city,
    [sketch.stateRegion, sketch.zip].filter(Boolean).join(" "),
  ].filter(Boolean).join("\n");

  // The live card, driven straight off the sketch — same CardData shape the
  // real editor and the published page build.
  const data: CardData = {
    name: sketch.name || "Your Name",
    title: sketch.title || "Your Title",
    company: sketch.company || "Your Company",
    phone: sketch.phone || "(555) 000-0000",
    email: sketch.email || "you@email.com",
    website: sketch.website,
    address: addressStr,
    initials: (sketch.name || "Y")[0].toUpperCase(),
    photoUrl: sketch.headshot,
    logoUrl: sketch.logo,
    cardUrl: "swiftcard.me/card/your-card",
    linkedin: sketch.socials.linkedin,
    instagram: sketch.socials.instagram,
    twitter: sketch.socials.twitter,
    tiktok: sketch.socials.tiktok,
    customization: { ...sketch.style, links: sketch.links },
  };

  function launch() {
    setLaunching(true);
    handOff();
    router.push("/cards/new");
  }

  // Closing just puts the builder away; opening always starts BLANK (owner
  // decision, Jul 2026): the open button calls reset() so a half-filled sketch
  // from an earlier play never greets the next visit.
  function close() {
    setOpen(false);
    setLaunching(false);
  }

  function startOver() {
    setOpen(false);
    setStep(0);
    setLaunching(false);
    reset();
  }

  const steps: MiniStep[] = [
    {
      title: "Who's on the card?",
      subtitle: "Just the basics — you can change any of it later.",
      canAdvance: sketch.name.trim().length > 0,
      content: (
        <>
          <Field label="Full name" placeholder="Alex Morgan" value={sketch.name} onChange={(e) => patch({ name: e.target.value })} autoFocus />
          <Field label="Title" placeholder="Founder & CEO" value={sketch.title} onChange={(e) => patch({ title: e.target.value })} />
          <Field label="Company" placeholder="Morgan & Co." value={sketch.company} onChange={(e) => patch({ company: e.target.value })} />
        </>
      ),
    },
    {
      title: "How do people reach you?",
      subtitle: "Phone and email get tap-to-call and tap-to-email on the real card.",
      content: (
        <>
          <Field label="Phone" type="tel" placeholder="(555) 123-4567" value={sketch.phone} onChange={(e) => patch({ phone: e.target.value })} autoFocus />
          <Field label="Email" type="email" placeholder="alex@morganco.com" value={sketch.email} onChange={(e) => patch({ email: e.target.value })} />
          <Field label="Website" placeholder="morganco.com" value={sketch.website} onChange={(e) => patch({ website: e.target.value })} />
          <Field label="Street address" placeholder="123 Main Street" value={sketch.street} onChange={(e) => patch({ street: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <Field label="City" placeholder="New York" value={sketch.city} onChange={(e) => patch({ city: e.target.value })} />
            <Field label="State" placeholder="NY" value={sketch.stateRegion} onChange={(e) => patch({ stateRegion: e.target.value })} />
            <Field label="ZIP" placeholder="10001" value={sketch.zip} onChange={(e) => patch({ zip: e.target.value })} />
          </div>
        </>
      ),
    },
    {
      title: "Add your photo & logo",
      subtitle: "A headshot and a company logo make the card unmistakably yours.",
      content: (
        <div className="space-y-5">
          <div>
            <ImageUpload guest field="photo" shape="circle" currentUrl={sketch.headshot} label="Headshot" onUploaded={(u) => patch({ headshot: u || null })} />
            {/* Looks your headshot up from the email you entered. Shows what it
                found and applies nothing until you pick it. */}
            <ProfilePhotoSuggest guest email={sketch.email} linkedinEnabled={linkedinEnabled} returnTo="/" onConfirm={(u) => patch({ headshot: u })} />
          </div>
          <div>
            <ImageUpload guest field="logo" shape="square" currentUrl={sketch.logo} label="Company logo" onUploaded={(u) => patch({ logo: u || null })} />
            <LogoSuggest company={sketch.company} email={sketch.email} onConfirm={(u) => patch({ logo: u })} />
          </div>
        </div>
      ),
    },
    {
      title: "Make it yours",
      subtitle: "Pick a template, then fine-tune the colours and font — exactly like the real editor.",
      content: (
        <div className="space-y-4">
          <div>
            <span className="block text-white/55 text-[12px] font-medium mb-2">Template</span>
            <div className="grid grid-cols-5 gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => patch({ template: t.id })}
                  className="rounded-lg px-1 py-2 text-[11px] font-medium transition-colors"
                  style={{
                    background: sketch.template === t.id ? "var(--rd-aurora)" : "rgba(255,255,255,0.05)",
                    color: sketch.template === t.id ? "#fff" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile-only: the shared preview column (see hidePreviewOnMobile
              below) is hidden for this step, and this inline copy sits right
              next to the template choices instead of at the bottom of the
              whole sheet, past the nav buttons. */}
          <div className="md:hidden flex justify-center">
            <InertPreview className="rounded-xl overflow-hidden border border-white/10 w-full max-w-[170px]">
              <CardScaler>
                <Preview data={data} />
              </CardScaler>
            </InertPreview>
          </div>

          {/* The very same control the signed-in card editor renders. */}
          <TemplateStyleControls value={sketch.style} onChange={patchStyle} template={sketch.template} />
        </div>
      ),
    },
  ];
  const isLastStep = step >= steps.length - 1;

  return (
    <>
      {/* The 6th grid tile */}
      <button
        type="button"
        onClick={() => { reset(); setStep(0); setOpen(true); }}
        className="text-left outline-none group"
        data-reveal
        style={{ transitionDelay: "350ms" }}
      >
        <p className="text-[13.5px] font-semibold mb-2 text-slate-500 group-hover:text-[#2563EB] transition-colors">Start from scratch</p>
        <div
          className="rounded-2xl flex flex-col items-center justify-center text-center gap-3 p-4 min-h-[150px] transition-all duration-200 group-hover:-translate-y-[3px]"
          style={{ aspectRatio: "1.75", border: "2px dashed #C9BEA8", background: "rgba(37,99,235,0.03)" }}
        >
          <span className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 shrink-0" style={{ background: "var(--rd-aurora)" }}>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          </span>
          <div className="px-2">
            <p className="text-slate-800 font-semibold text-[14px] leading-tight">See how your card would look</p>
            <p className="text-slate-500 text-[12px] mt-1">Takes 60 seconds — no signup</p>
          </div>
        </div>
      </button>

      <MiniBuilderModal
        open={open}
        onClose={close}
        onStartOver={startOver}
        eyebrow="Build your card"
        step={step}
        setStep={setStep}
        steps={steps}
        onLaunch={launch}
        launching={launching}
        launchLabel="Make it live →"
        previewCaption="This is your real card — same as recipients see."
        hidePreviewOnMobile={isLastStep}
        preview={
          <InertPreview className="w-[260px] max-w-full">
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              <CardScaler><Preview data={data} /></CardScaler>
            </div>
          </InertPreview>
        }
      />
    </>
  );
}
