"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ImageUpload";
import InertPreview from "@/components/InertPreview";
import { IcoInsta, IcoLinkedIn, IcoX, IcoTikTok } from "@/components/card-templates/shared";
import ProfilePhotoSuggest from "@/components/ProfilePhotoSuggest";
import TemplateStyleControls from "@/components/card-templates/TemplateStyleControls";
import MiniBuilderModal, { type MiniStep } from "./MiniBuilderModal";
import { useProductSketch } from "./useProductSketch";
import { Field, TextArea, SocialFields, LinkButtons } from "./BuilderFields";

// "See how your SwiftLink would look" builder for the homepage SwiftLinks
// section. Mirrors how a SwiftLink is really created: your @handle is generated
// from your name + business name, you add a profile photo, a bio, your socials,
// and any custom links. The preview is the real link.me-style profile driven by
// what you type; "Make it live" hands off to /cards/new (the SwiftLink lives on
// the same card record) on the Swift Links step with everything prefilled.

function slugify(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}


const SOCIAL_ICONS: Record<string, { node: React.ReactNode; color: string }> = {
  instagram: { node: <IcoInsta />, color: "#E1306C" },
  tiktok: { node: <IcoTikTok />, color: "#0f172a" },
  linkedin: { node: <IcoLinkedIn />, color: "#0A66C2" },
  twitter: { node: <IcoX />, color: "#0f172a" },
};

function hostOf(url: string) {
  try { return new URL(url.includes("://") ? url : `https://${url}`).host.replace(/^www\./, ""); } catch { return url; }
}

export default function SwiftLinkMiniBuilder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const { sketch, patch, patchStyle, patchSocial, handOff, reset } = useProductSketch("swiftlink", open);

  // Handle is derived exactly like the real builder: name + business, slugified.
  const handle = slugify(sketch.company.trim() ? `${sketch.name} ${sketch.company}` : sketch.name) || "yourname";
  const initials = (sketch.name || "Y").trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "Y";
  const firstName = (sketch.name || "me").split(" ")[0];
  const activeSocials = [
    sketch.socials.instagram && { key: "instagram", handle: sketch.socials.instagram },
    sketch.socials.tiktok && { key: "tiktok", handle: sketch.socials.tiktok },
    sketch.socials.linkedin && { key: "linkedin", handle: sketch.socials.linkedin },
    sketch.socials.twitter && { key: "twitter", handle: sketch.socials.twitter },
  ].filter(Boolean) as { key: string; handle: string }[];

  // The SwiftLink page's own look. bgColor/textColor/fontFamily are the same
  // keys the card editor writes, so a visitor's palette follows them across
  // products and into the account.
  const pageBg = sketch.style.bgColor || "#191a1a";
  const pageText = sketch.style.textColor || "#ffffff";
  const pageFont = sketch.style.fontFamily;

  function launch() {
    setLaunching(true);
    handOff();
    router.push("/cards/new");
  }

  // Closing = back to the homepage = abandoned (see resetGuestFlow).
  function closeAndReset() {
    setOpen(false);
    setStep(0);
    setLaunching(false);
    reset();
  }

  const steps: MiniStep[] = [
    {
      title: "Name your SwiftLink",
      subtitle: "Your @handle is built from your name and business — this is the page that lives in your bio.",
      canAdvance: sketch.name.trim().length > 0,
      content: (
        <>
          <Field label="Your name" placeholder="Alex Morgan" value={sketch.name} onChange={(e) => patch({ name: e.target.value })} autoFocus />
          <Field label="Business name" placeholder="Morgan & Co." value={sketch.company} onChange={(e) => patch({ company: e.target.value })} />
          <div className="flex items-center gap-2 rounded-xl bg-[#15171F] border border-white/10 px-3.5 py-2.5">
            <span className="text-white/40 text-[12px]">Your handle</span>
            <span className="text-white font-semibold text-sm truncate">swiftcard.me/links/{handle}</span>
          </div>
          <div className="pt-1">
            <span className="block text-white/55 text-[12px] font-medium mb-1.5">Profile photo</span>
            <ImageUpload guest field="photo" shape="circle" currentUrl={sketch.headshot} label="" onUploaded={(u) => patch({ headshot: u || null })} />
            <ProfilePhotoSuggest guest email={sketch.email} linkedinEnabled={false} returnTo="/" onConfirm={(u) => patch({ headshot: u })} />
          </div>
        </>
      ),
    },
    {
      title: "Add a short bio",
      subtitle: "One or two lines about what you do — this sits under your name.",
      content: (
        <>
          <TextArea
            label="Bio"
            placeholder="Founder & CEO at Morgan & Co. Helping brands grow"
            value={sketch.bio}
            onChange={(e) => patch({ bio: e.target.value })}
            autoFocus
          />
          {/* Only used to look a profile photo up — never shown on the page. */}
          <Field label="Email (for photo suggestions)" type="email" placeholder="alex@morganco.com" value={sketch.email} onChange={(e) => patch({ email: e.target.value })} />
        </>
      ),
    },
    {
      title: "Link your socials",
      subtitle: "Add the ones you have — they show as tappable icons on your page.",
      content: <SocialFields socials={sketch.socials} onChange={patchSocial} />,
    },
    {
      title: "Add your links",
      subtitle: "Booking pages, your website, a latest drop — anything you want front and center.",
      content: (
        <LinkButtons
          links={sketch.links}
          onChange={(links) => patch({ links })}
          label="Links"
          hint="These become the big tappable buttons down your page."
        />
      ),
    },
    {
      title: "Style your page",
      subtitle: "Background, text colour and font — your page updates live.",
      content: <TemplateStyleControls value={sketch.style} onChange={patchStyle} template={sketch.template} />,
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
        See how your SwiftLink would look
      </button>

      <MiniBuilderModal
        open={open}
        onClose={closeAndReset}
        eyebrow="Build your SwiftLink"
        step={step}
        setStep={setStep}
        steps={steps}
        onLaunch={launch}
        launching={launching}
        launchLabel="Make it live →"
        previewCaption="Lives in your Instagram, TikTok, or email bio."
        // Look-only preview — the real SwiftLink page keeps its tappable
        // links; see InertPreview.
        preview={
          <InertPreview>
            <div className="w-[236px] rounded-[26px] overflow-hidden shadow-2xl" style={{ background: pageBg }}>
              {/* Hero */}
              <div className="relative w-full aspect-square overflow-hidden">
                {sketch.headshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sketch.headshot} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(160deg,#181538,#2A2466 60%,#4338ca)" }}>
                    <span className="text-white/90 font-extrabold text-5xl">{initials}</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none" style={{ background: `linear-gradient(180deg,transparent,${pageBg})` }} />
              </div>
              {/* Sheet */}
              <div className="relative -mt-6 rounded-t-[22px] px-4 pt-4 pb-6 text-center" style={{ background: pageBg, color: pageText, fontFamily: pageFont }}>
                <div className="flex items-center justify-center gap-1">
                  <p className="text-white font-extrabold text-[19px] leading-tight truncate">{sketch.name || "Your Name"}</p>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0"><path d="M12 1.5l2.35 2.03 3.08-.45 1.07 2.92 2.92 1.07-.45 3.08L23 12l-2.03 2.35.45 3.08-2.92 1.07-1.07 2.92-3.08-.45L12 23l-2.35-2.03-3.08.45-1.07-2.92-2.92-1.07.45-3.08L1 12l2.03-2.35-.45-3.08 2.92-1.07 1.07-2.92 3.08.45L12 1.5z" fill="#2196F3" /><path d="M7.5 12.2l3 3 6-6.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                </div>
                <p className="text-white/45 text-[12px]">@{handle}</p>
                {sketch.company && <p className="text-white/55 text-[11px] font-medium mt-1.5">{sketch.company}</p>}
                {sketch.bio && <p className="text-white/75 text-[11.5px] leading-snug mt-2 line-clamp-3">{sketch.bio}</p>}
                {activeSocials.length > 0 && (
                  <div className="flex items-center justify-center gap-2.5 mt-3">
                    {activeSocials.map((s) => (
                      <span key={s.key} className="w-8 h-8 rounded-full bg-white flex items-center justify-center" style={{ color: SOCIAL_ICONS[s.key].color }}>
                        <span className="scale-[1.3] flex">{SOCIAL_ICONS[s.key].node}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3.5 w-full py-2.5 rounded-2xl text-white text-[12.5px] font-semibold" style={{ background: "#1D4ED8" }}>
                  Connect with {firstName}
                </div>
                {sketch.links.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {sketch.links.slice(0, 3).map((l, i) => (
                      <div key={i} className="w-full rounded-2xl px-3 py-2.5 text-left bg-white/[0.04] border border-white/10">
                        <span className="block text-white text-[12px] font-semibold truncate">{l.label}</span>
                        <span className="block text-white/40 text-[10px] truncate">{hostOf(l.url)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-white/35 text-[10px] mt-4 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#1D4ED8" }} />
                  Powered by SwiftCard.me
                </p>
              </div>
            </div>
          </InertPreview>
        }
      />
    </>
  );
}
