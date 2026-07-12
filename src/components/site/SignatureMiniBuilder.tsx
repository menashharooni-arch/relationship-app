"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import { withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";
import { writePrefill } from "@/lib/prefill";
import MiniBuilderModal, { type MiniStep } from "./MiniBuilderModal";

// "See your email signature" builder for the homepage signature section. The
// signature is just your card rendered under your name, so it needs the same
// core details — name/title/company, email/phone. Shows the live signature,
// then hands off to /cards/new prefilled; the signature is generated from the
// card the visitor finishes there.

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

  const data: CardData = withoutSocials({
    name: name || "Your Name",
    title: title || "Your Title",
    company: company || "Your Company",
    phone: phone || "(555) 000-0000",
    email: email || "you@email.com",
    website: "",
    initials: (name || "Y")[0].toUpperCase(),
    photoUrl: null,
    logoUrl: null,
    cardUrl: "swiftcard.me/card/your-card",
    customization: {},
  });

  function launch() {
    setLaunching(true);
    writePrefill({
      name: name.trim(),
      title: title.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      step: 1,
    });
    router.push("/cards/new");
  }

  const steps: MiniStep[] = [
    {
      title: "Who's signing off?",
      subtitle: "Your signature is your card under your name — start with the basics.",
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
  ];

  return (
    <>
      <div className="flex justify-center mt-8" data-reveal="fade">
        <button
          type="button"
          onClick={() => { setStep(0); setOpen(true); }}
          className="rd-btn rd-btn-primary rd-btn-lg"
        >
          See your email signature
        </button>
      </div>

      <MiniBuilderModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Build your signature"
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
              <CardScaler><ClassicPro data={data} /></CardScaler>
            </div>
            <p className="mt-2 text-[13px] font-bold" style={{ color: "#2563eb" }}>Contact me →</p>
          </div>
        }
      />
    </>
  );
}
