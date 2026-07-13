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

// "See how your Swift Signature would look" builder for the homepage signature
// section. Your signature IS your card rendered under your name, so it needs the
// same details a card does — name/title/company, email/phone, headshot + logo,
// and a template. Shows the live signature, then hands off to /cards/new
// prefilled; the real signature is generated from the card you finish there.

const TEMPLATES = [
  { id: "classic-pro", label: "Classic", Component: ClassicPro },
  { id: "modern-bold", label: "Modern", Component: ModernBold },
  { id: "photo-first", label: "Photo", Component: PhotoFirst },
  { id: "local-business", label: "Local", Component: LocalBusiness },
  { id: "luxury-minimal", label: "Luxury", Component: LuxuryMinimal },
];

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

export default function SignatureMiniBuilder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [headshot, setHeadshot] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [template, setTemplate] = useState("classic-pro");

  const Preview = TEMPLATES.find((t) => t.id === template)?.Component ?? ClassicPro;
  const data: CardData = withoutSocials({
    name: name || "Your Name",
    title: title || "Your Title",
    company: company || "Your Company",
    phone: phone || "(555) 000-0000",
    email: email || "you@email.com",
    website: "",
    initials: (name || "Y")[0].toUpperCase(),
    photoUrl: headshot,
    logoUrl: logo,
    cardUrl: "swiftcard.me/card/your-card",
    customization: {},
  });

  const sketch = () => ({
    name: name.trim(),
    title: title.trim(),
    company: company.trim(),
    email: email.trim(),
    phone: phone.trim(),
    template,
    headshotUrl: headshot,
    logoUrl: logo,
  });

  // Keep the sketch stashed as they type, so a generic "Get started" /
  // "Create your free card" click elsewhere carries it too (lands on step 1).
  useEffect(() => {
    if (open) stashSketch(sketch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, name, title, company, email, phone, template, headshot, logo]);

  function launch() {
    setLaunching(true);
    writePrefill({ ...sketch(), step: 1 });
    router.push("/cards/new");
  }

  const steps: MiniStep[] = [
    {
      title: "Who's signing off?",
      subtitle: "Your Swift Signature is your card under your name — start with the basics.",
      canAdvance: name.trim().length > 0,
      content: (
        <>
          <Field label="Full name" placeholder="Alex Morgan" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Field label="Title" placeholder="Realtor" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Field label="Company" placeholder="Coastline Realty" value={company} onChange={(e) => setCompany(e.target.value)} />
        </>
      ),
    },
    {
      title: "Your contact details",
      subtitle: "These sit inside the card so anyone can reach you in one tap.",
      content: (
        <>
          <Field label="Email" type="email" placeholder="alex@coastlinerealty.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <Field label="Phone" type="tel" placeholder="(415) 555-0188" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </>
      ),
    },
    {
      title: "Add your photo & logo",
      subtitle: "A headshot and logo make your Swift Signature unmistakably yours.",
      content: (
        <div className="space-y-5">
          <ImageUpload guest field="photo" shape="circle" currentUrl={headshot} label="Headshot" onUploaded={(u) => setHeadshot(u || null)} />
          <ImageUpload guest field="logo" shape="square" currentUrl={logo} label="Company logo" onUploaded={(u) => setLogo(u || null)} />
        </div>
      ),
    },
    {
      title: "Pick a template",
      subtitle: "Your signature renders in this design — it updates live.",
      content: (
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
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-center mt-8" data-reveal="fade">
        <button
          type="button"
          onClick={() => { setStep(0); setOpen(true); }}
          className="rd-btn rd-btn-primary rd-btn-lg"
        >
          See how your Swift Signature would look
        </button>
      </div>

      <MiniBuilderModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Build your Swift Signature"
        step={step}
        setStep={setStep}
        steps={steps}
        onLaunch={launch}
        launching={launching}
        launchLabel="Make it live →"
        previewCaption="Drops into Gmail, Outlook, Apple Mail & more."
        preview={
          <div className="w-[280px] max-w-full rounded-2xl p-4" style={{ background: "#FAF7F2" }}>
            <p className="text-[13px] text-slate-900 mb-2">
              <strong>{name || "Your Name"}</strong>
              {company ? <span className="text-slate-500"> | {company}</span> : null}
            </p>
            <div className="rounded-2xl overflow-hidden shadow-[0_10px_30px_-14px_rgba(8,10,18,0.5)]">
              <CardScaler><Preview data={data} /></CardScaler>
            </div>
            <p className="mt-2 text-[13px] font-bold" style={{ color: "#2563eb" }}>Contact me →</p>
          </div>
        }
      />
    </>
  );
}
