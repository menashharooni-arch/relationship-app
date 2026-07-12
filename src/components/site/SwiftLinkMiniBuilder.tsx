"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { writePrefill } from "@/lib/prefill";
import MiniBuilderModal, { type MiniStep } from "./MiniBuilderModal";

// "Create your SwiftLink" builder for the homepage SwiftLinks section. Collects
// only what a link.me-style profile needs to preview — name, @handle, bio, and a
// few socials — renders a live mini-profile, then hands off to /cards/new (the
// SwiftLink lives on the same card record) landing on the Swift Links step with
// everything prefilled.

const inputCls =
  "w-full bg-[#15171F] border border-white/10 text-white placeholder-white/30 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors";

function Field({ label, prefix, ...props }: { label: string; prefix?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-white/55 text-[12px] font-medium mb-1.5">{label}</span>
      <div className="relative">
        {prefix && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-sm">{prefix}</span>}
        <input className={inputCls} style={prefix ? { paddingLeft: 26 } : undefined} {...props} />
      </div>
    </label>
  );
}

const SOCIAL_COLORS: Record<string, string> = {
  Instagram: "#E1306C", LinkedIn: "#0A66C2", TikTok: "#111", Website: "#2563EB",
};

export default function SwiftLinkMiniBuilder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [website, setWebsite] = useState("");

  const initials = (name || "Y").trim()[0]?.toUpperCase() ?? "Y";
  const shownHandle = (handle || name.toLowerCase().replace(/[^a-z0-9]/g, "") || "yourname").replace(/^@/, "");
  const pills = [
    instagram && "Instagram",
    linkedin && "LinkedIn",
    tiktok && "TikTok",
    website && "Website",
  ].filter(Boolean) as string[];

  function launch() {
    setLaunching(true);
    writePrefill({
      name: name.trim(),
      bio: bio.trim(),
      website: website.trim(),
      socials: {
        ...(instagram.trim() ? { instagram: instagram.trim() } : {}),
        ...(linkedin.trim() ? { linkedin: linkedin.trim() } : {}),
        ...(tiktok.trim() ? { tiktok: tiktok.trim() } : {}),
      },
      step: 2,
    });
    router.push("/cards/new");
  }

  const steps: MiniStep[] = [
    {
      title: "Name your SwiftLink",
      subtitle: "This is the page that lives in your bio — give it a name and a handle.",
      canAdvance: name.trim().length > 0,
      content: (
        <>
          <Field label="Display name" placeholder="Alex Morgan" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Field label="Handle" prefix="@" placeholder="alexmorgan" value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))} />
        </>
      ),
    },
    {
      title: "Add a short bio",
      subtitle: "One or two lines about what you do — this sits under your name.",
      content: (
        <label className="block">
          <span className="block text-white/55 text-[12px] font-medium mb-1.5">Bio</span>
          <textarea
            className={inputCls + " resize-none"}
            rows={3}
            placeholder="Founder & CEO at Morgan & Co. Helping brands grow 🚀"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            autoFocus
          />
        </label>
      ),
    },
    {
      title: "Link your socials",
      subtitle: "Add the ones you have — you can add more (and custom links) after.",
      content: (
        <>
          <Field label="Instagram" prefix="@" placeholder="yourhandle" value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))} autoFocus />
          <Field label="TikTok" prefix="@" placeholder="yourhandle" value={tiktok} onChange={(e) => setTiktok(e.target.value.replace(/^@/, ""))} />
          <Field label="LinkedIn" placeholder="linkedin.com/in/you" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
          <Field label="Website" placeholder="yoursite.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </>
      ),
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => { setStep(0); setOpen(true); }}
        className="rd-btn rd-btn-aurora rd-btn-lg mt-2"
        data-reveal
      >
        Create your SwiftLink — free
      </button>

      <MiniBuilderModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Build your SwiftLink"
        step={step}
        setStep={setStep}
        steps={steps}
        onLaunch={launch}
        launching={launching}
        launchLabel="Make it live →"
        previewCaption="Lives in your Instagram, TikTok, or email bio."
        preview={
          <div className="w-[228px] rounded-[26px] overflow-hidden shadow-2xl" style={{ background: "#191a1a" }}>
            <div className="h-20" style={{ background: "linear-gradient(135deg,#1d4ed8,#4338ca 55%,#7c3aed)" }} />
            <div className="px-4 pb-5 -mt-9 text-center">
              <div className="w-[62px] h-[62px] rounded-full mx-auto flex items-center justify-center text-white font-bold text-lg" style={{ background: "var(--rd-aurora)", border: "4px solid #191a1a" }}>{initials}</div>
              <p className="text-white font-bold text-[16px] mt-2 truncate">{name || "Your Name"}</p>
              <p className="text-white/45 text-[12px]">@{shownHandle}</p>
              {bio && <p className="text-white/70 text-[11.5px] leading-snug mt-2 line-clamp-3">{bio}</p>}
              {pills.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                  {pills.map((p) => (
                    <span key={p} className="text-white text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: SOCIAL_COLORS[p] }}>{p}</span>
                  ))}
                </div>
              )}
              <div className="mt-3.5 w-full py-2.5 rounded-2xl text-white text-[12.5px] font-semibold" style={{ background: "#1D4ED8" }}>
                Connect with {(name || "me").split(" ")[0]}
              </div>
            </div>
          </div>
        }
      />
    </>
  );
}
