"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ImageUpload";
import InertPreview from "@/components/InertPreview";
import ProfilePhotoSuggest from "@/components/ProfilePhotoSuggest";
import { SwiftLinkStyleControls, SwiftLinkPagePreview } from "@/components/SwiftLinkDesign";
import MiniBuilderModal, { type MiniStep } from "./MiniBuilderModal";
import { useProductSketch } from "./useProductSketch";
import { Field, TextArea, SocialFields, LinkButtons } from "./BuilderFields";

// "See how your SwiftLink would look" builder for the homepage SwiftLinks
// section. Three steps: (1) name, business & profile photo, (2) bio, socials &
// additional links, (3) style your page. The preview is the real link.me-style
// profile driven by what you type; "Make it live" hands off to /cards/new (the
// SwiftLink lives on the same card record) starting at the FIRST wizard step
// with everything prefilled, so the visitor walks through card creation +
// account setup from the beginning.

function slugify(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}


export default function SwiftLinkMiniBuilder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const { sketch, patch, patchLinkStyle, patchSocial, handOff, reset } = useProductSketch("swiftlink", open);

  // Handle is derived exactly like the real builder: name + business, slugified.
  const handle = slugify(sketch.company.trim() ? `${sketch.name} ${sketch.company}` : sketch.name) || "yourname";
  const activeSocials = [
    sketch.socials.instagram && { key: "instagram", handle: sketch.socials.instagram },
    sketch.socials.tiktok && { key: "tiktok", handle: sketch.socials.tiktok },
    sketch.socials.linkedin && { key: "linkedin", handle: sketch.socials.linkedin },
    sketch.socials.twitter && { key: "twitter", handle: sketch.socials.twitter },
  ].filter(Boolean) as { key: string; handle: string }[];

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
    // 1 — name, business & profile photo
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
            {/* Only used to look your headshot up — never shown on the page. */}
            <Field label="Email (only used to find your headshot)" type="email" placeholder="alex@morganco.com" value={sketch.email} onChange={(e) => patch({ email: e.target.value })} />
          </div>
        </>
      ),
    },
    // 2 — bio, all socials & additional links
    {
      title: "Your bio, socials & links",
      subtitle: "A line about you, the socials you have, and any links you want front and center.",
      content: (
        <div className="space-y-4">
          <TextArea
            label="Bio"
            placeholder="Founder & CEO at Morgan & Co. Helping brands grow"
            value={sketch.bio}
            onChange={(e) => patch({ bio: e.target.value })}
            autoFocus
          />
          <SocialFields socials={sketch.socials} onChange={patchSocial} />
          <LinkButtons
            links={sketch.links}
            onChange={(links) => patch({ links })}
            label="Additional links"
            hint="Add your links — can be a review page, recent video, listing, etc."
          />
        </div>
      ),
    },
    // 3 — style your page (the Swift Links page's own design keys)
    {
      title: "Style your page",
      subtitle: "Background, text colour and font — your Swift Links page updates live.",
      content: <SwiftLinkStyleControls value={sketch.linkStyle} onChange={patchLinkStyle} />,
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setStep(0); setOpen(true); }}
        className="rd-btn rd-btn-aurora rd-btn-lg mt-2"
        data-reveal
      >
        See how your SwiftLink would look
      </button>

      <MiniBuilderModal
        open={open}
        onClose={close}
        onStartOver={startOver}
        eyebrow="Build your SwiftLink"
        step={step}
        setStep={setStep}
        steps={steps}
        onLaunch={launch}
        launching={launching}
        launchLabel="Make it live →"
        previewCaption="Lives in your Instagram, TikTok, or email bio."
        // Look-only preview — the real SwiftLink page keeps its tappable
        // links; see InertPreview. This is the SAME SwiftLinkPagePreview
        // component the portal's "Social design" step renders, so the demo
        // phone here shows exactly what the real Swift Links page will look
        // like — one mock, no drift.
        preview={
          <InertPreview>
            <SwiftLinkPagePreview
              style={sketch.linkStyle}
              name={sketch.name}
              handle={handle}
              company={sketch.company}
              bio={sketch.bio}
              photoUrl={sketch.headshot}
              socialKeys={activeSocials.map((s) => s.key)}
              links={sketch.links}
            />
          </InertPreview>
        }
      />
    </>
  );
}
