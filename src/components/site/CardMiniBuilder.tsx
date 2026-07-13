"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CardScaler from "@/components/CardScaler";
import ImageUpload from "@/components/ImageUpload";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import { withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";
import { writePrefill, stashSketch } from "@/lib/prefill";
import MiniBuilderModal, { type MiniStep } from "./MiniBuilderModal";

// The 6th tile in the Swift Cards template grid: a dashed card outline with a
// "+" that opens a real card builder. It collects everything a card actually
// needs — name/title/company, phone/email/address, headshot + logo, template +
// accent — and skips only what isn't on the card itself (socials live in Swift
// Links). The real template renders live; "Make it live" hands off to
// /cards/new with everything (including the cropped images) prefilled.

const TEMPLATES = [
  { id: "classic-pro", label: "Classic", Component: ClassicPro },
  { id: "modern-bold", label: "Modern", Component: ModernBold },
  { id: "photo-first", label: "Photo", Component: PhotoFirst },
  { id: "local-business", label: "Local", Component: LocalBusiness },
  { id: "luxury-minimal", label: "Luxury", Component: LuxuryMinimal },
];

const ACCENTS = ["#2563EB", "#7C3AED", "#059669", "#E11D48", "#D97706", "#0E1B35"];

const inputCls =
  "w-full bg-[#15171F] border border-white/10 text-white placeholder-white/30 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors";

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-white/55 text-[12px] font-medium mb-1.5">{label}</span>
      <input className={inputCls} {...props} />
    </label>
  );
}

export default function CardMiniBuilder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [zip, setZip] = useState("");
  const [headshot, setHeadshot] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [template, setTemplate] = useState("classic-pro");
  const [accent, setAccent] = useState("");

  const Preview = TEMPLATES.find((t) => t.id === template)?.Component ?? ClassicPro;
  const addressStr = [street, city, [stateRegion, zip].filter(Boolean).join(" ")].filter(Boolean).join("\n");
  const data: CardData = withoutSocials({
    name: name || "Your Name",
    title: title || "Your Title",
    company: company || "Your Company",
    phone: phone || "(555) 000-0000",
    email: email || "you@email.com",
    website: "",
    address: addressStr,
    initials: (name || "Y")[0].toUpperCase(),
    photoUrl: headshot,
    logoUrl: logo,
    cardUrl: "swiftcard.me/card/your-card",
    customization: accent ? { accentColor: accent } : {},
  });

  // What the visitor has sketched so far, in wizard-prefill shape.
  const sketch = () => ({
    name: name.trim(),
    title: title.trim(),
    company: company.trim(),
    phone: phone.trim(),
    email: email.trim(),
    address: { street: street.trim(), city: city.trim(), state: stateRegion.trim(), zip: zip.trim() },
    template,
    accentColor: accent || undefined,
    headshotUrl: headshot,
    logoUrl: logo,
  });

  // Keep the sketch stashed as they type, so a generic "Get started" /
  // "Create your free card" click elsewhere carries it too (lands on step 1).
  useEffect(() => {
    if (open) stashSketch(sketch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, name, title, company, phone, email, street, city, stateRegion, zip, template, accent, headshot, logo]);

  function launch() {
    setLaunching(true);
    // Explicit "Make it live" → jump straight to the first info step, prefilled.
    writePrefill({ ...sketch(), step: 1 });
    router.push("/cards/new");
  }

  const steps: MiniStep[] = [
    {
      title: "Who's on the card?",
      subtitle: "Just the basics — you can change any of it later.",
      canAdvance: name.trim().length > 0,
      content: (
        <>
          <Field label="Full name" placeholder="Alex Morgan" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Field label="Title" placeholder="Founder & CEO" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Field label="Company" placeholder="Morgan & Co." value={company} onChange={(e) => setCompany(e.target.value)} />
        </>
      ),
    },
    {
      title: "How do people reach you?",
      subtitle: "Phone and email get tap-to-call and tap-to-email on the card.",
      content: (
        <>
          <Field label="Phone" type="tel" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
          <Field label="Email" type="email" placeholder="alex@morganco.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Street address" placeholder="123 Main Street" value={street} onChange={(e) => setStreet(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <Field label="City" placeholder="New York" value={city} onChange={(e) => setCity(e.target.value)} />
            <Field label="State" placeholder="NY" value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} />
            <Field label="ZIP" placeholder="10001" value={zip} onChange={(e) => setZip(e.target.value)} />
          </div>
        </>
      ),
    },
    {
      title: "Add your photo & logo",
      subtitle: "A headshot and a company logo make the card unmistakably yours.",
      content: (
        <div className="space-y-5">
          <ImageUpload guest field="photo" shape="circle" currentUrl={headshot} label="Headshot" onUploaded={(u) => setHeadshot(u || null)} />
          <ImageUpload guest field="logo" shape="square" currentUrl={logo} label="Company logo" onUploaded={(u) => setLogo(u || null)} />
        </div>
      ),
    },
    {
      title: "Pick a look",
      subtitle: "Choose a template and an accent — everything updates live.",
      content: (
        <>
          <div>
            <span className="block text-white/55 text-[12px] font-medium mb-2">Template</span>
            <div className="grid grid-cols-5 gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className="rounded-lg px-1 py-2 text-[11px] font-medium transition-colors"
                  style={{
                    background: template === t.id ? "var(--rd-aurora)" : "rgba(255,255,255,0.05)",
                    color: template === t.id ? "#fff" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-white/55 text-[12px] font-medium mb-2">Accent color</span>
            <div className="flex items-center gap-2">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAccent(c)}
                  aria-label={`Accent ${c}`}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                  style={{ background: c, outline: accent === c ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2 }}
                />
              ))}
              {/* Custom — pick any color, not just the presets */}
              <label className="relative w-8 h-8 rounded-full cursor-pointer overflow-hidden shrink-0" title="Custom color"
                style={{ background: accent && !ACCENTS.includes(accent) ? accent : "conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444)", outline: accent && !ACCENTS.includes(accent) ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2 }}>
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#2563EB"} onChange={(e) => setAccent(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Custom accent color" />
              </label>
            </div>
          </div>
        </>
      ),
    },
  ];

  return (
    <>
      {/* The 6th grid tile */}
      <button
        type="button"
        onClick={() => { setStep(0); setOpen(true); }}
        className="text-left outline-none group"
        data-reveal
        style={{ transitionDelay: "350ms" }}
      >
        <p className="text-[13.5px] font-semibold mb-2 text-slate-500 group-hover:text-[#2563EB] transition-colors">Start from scratch</p>
        <div
          className="rounded-2xl flex flex-col items-center justify-center text-center gap-3 transition-all duration-200 group-hover:-translate-y-[3px]"
          style={{
            aspectRatio: "1.75",
            border: "2px dashed #C9BEA8",
            background: "rgba(37,99,235,0.03)",
          }}
        >
          <span className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110" style={{ background: "var(--rd-aurora)" }}>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          </span>
          <div className="px-4">
            <p className="text-slate-800 font-semibold text-[14px] leading-tight">See how your card would look</p>
            <p className="text-slate-500 text-[12px] mt-1">Takes 60 seconds — no signup</p>
          </div>
        </div>
      </button>

      <MiniBuilderModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Build your card"
        step={step}
        setStep={setStep}
        steps={steps}
        onLaunch={launch}
        launching={launching}
        launchLabel="Make it live →"
        previewCaption="This is your real card — same as recipients see."
        preview={
          <div className="w-[260px] max-w-full">
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              <CardScaler><Preview data={data} /></CardScaler>
            </div>
          </div>
        }
      />
    </>
  );
}
