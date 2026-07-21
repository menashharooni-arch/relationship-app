"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ImageUpload";
import { IcoInsta, IcoLinkedIn, IcoX, IcoTikTok } from "@/components/card-templates/shared";
import { writePrefill, stashSketch } from "@/lib/prefill";
import { resetGuestFlow } from "@/lib/guest-reset";
import MiniBuilderModal, { type MiniStep } from "./MiniBuilderModal";

// "See how your SwiftLink would look" builder for the homepage SwiftLinks
// section. Mirrors how a SwiftLink is really created: your @handle is generated
// from your name + business name, you add a profile photo, a bio, your socials,
// and any custom links. The preview is the real link.me-style profile driven by
// what you type; "Make it live" hands off to /cards/new (the SwiftLink lives on
// the same card record) on the Swift Links step with everything prefilled.

function slugify(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

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

  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
  const [newLink, setNewLink] = useState({ label: "", url: "" });

  // Handle is derived exactly like the real builder: name + business, slugified.
  const handle = slugify(business.trim() ? `${name} ${business}` : name) || "yourname";
  const initials = (name || "Y").trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "Y";
  const firstName = (name || "me").split(" ")[0];
  const activeSocials = [
    instagram && { key: "instagram", handle: instagram },
    tiktok && { key: "tiktok", handle: tiktok },
    linkedin && { key: "linkedin", handle: linkedin },
    twitter && { key: "twitter", handle: twitter },
  ].filter(Boolean) as { key: string; handle: string }[];

  function addLink() {
    const label = newLink.label.trim();
    const url = newLink.url.trim();
    if (!label || !url) return;
    setLinks((prev) => [...prev, { label, url }]);
    setNewLink({ label: "", url: "" });
  }

  const sketch = () => ({
    name: name.trim(),
    company: business.trim(),
    bio: bio.trim(),
    headshotUrl: photo,
    socials: {
      ...(instagram.trim() ? { instagram: instagram.trim() } : {}),
      ...(tiktok.trim() ? { tiktok: tiktok.trim() } : {}),
      ...(linkedin.trim() ? { linkedin: linkedin.trim() } : {}),
      ...(twitter.trim() ? { twitter: twitter.trim() } : {}),
    },
    links,
  });

  // Keep the sketch stashed as they type, so a generic "Get started" /
  // "Create your free card" click elsewhere carries it too.
  useEffect(() => {
    if (open) stashSketch(sketch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, name, business, bio, photo, instagram, tiktok, linkedin, twitter, links]);

  function launch() {
    setLaunching(true);
    // Land on the first info step (name/details); the sketched bio, socials and
    // links are autofilled and appear on the Swift Links step.
    writePrefill({ ...sketch(), step: 1 });
    router.push("/cards/new");
  }

  // Closing this preview (X / Esc / backdrop) puts the visitor back on the
  // homepage, which means they abandoned the sketch — so drop BOTH the stashed
  // prefill and the in-memory field values, so the builder reopens blank rather
  // than restoring (and re-stashing) what they typed.
  function closeAndReset() {
    setOpen(false);
    setStep(0);
    setLaunching(false);
    setName(""); setBusiness(""); setPhoto(null); setBio("");
    setInstagram(""); setTiktok(""); setLinkedin(""); setTwitter("");
    setLinks([]); setNewLink({ label: "", url: "" });
    resetGuestFlow();
  }

  const steps: MiniStep[] = [
    {
      title: "Name your SwiftLink",
      subtitle: "Your @handle is built from your name and business — this is the page that lives in your bio.",
      canAdvance: name.trim().length > 0,
      content: (
        <>
          <Field label="Your name" placeholder="Alex Morgan" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Field label="Business name" placeholder="Morgan & Co." value={business} onChange={(e) => setBusiness(e.target.value)} />
          <div className="flex items-center gap-2 rounded-xl bg-[#15171F] border border-white/10 px-3.5 py-2.5">
            <span className="text-white/40 text-[12px]">Your handle</span>
            <span className="text-white font-semibold text-sm truncate">swiftcard.me/links/{handle}</span>
          </div>
          <div className="pt-1">
            <span className="block text-white/55 text-[12px] font-medium mb-1.5">Profile photo</span>
            <ImageUpload guest field="photo" shape="circle" currentUrl={photo} label="" onUploaded={(u) => setPhoto(u || null)} />
          </div>
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
            placeholder="Founder & CEO at Morgan & Co. Helping brands grow"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            autoFocus
          />
        </label>
      ),
    },
    {
      title: "Link your socials",
      subtitle: "Add the ones you have — they show as tappable icons on your page.",
      content: (
        <>
          <Field label="Instagram" prefix="@" placeholder="yourhandle" value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))} autoFocus />
          <Field label="TikTok" prefix="@" placeholder="yourhandle" value={tiktok} onChange={(e) => setTiktok(e.target.value.replace(/^@/, ""))} />
          <Field label="LinkedIn" placeholder="linkedin.com/in/you" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
          <Field label="X (Twitter)" prefix="@" placeholder="yourhandle" value={twitter} onChange={(e) => setTwitter(e.target.value.replace(/^@/, ""))} />
        </>
      ),
    },
    {
      title: "Add your links",
      subtitle: "Booking pages, your website, a latest drop — anything you want front and center.",
      content: (
        <>
          {links.length > 0 && (
            <div className="space-y-2">
              {links.map((l, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-[#15171F] border border-white/10 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-white text-[13px] font-medium truncate">{l.label}</span>
                    <span className="block text-white/40 text-[11px] truncate">{hostOf(l.url)}</span>
                  </span>
                  <button onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove link" className="text-white/40 hover:text-red-400 shrink-0">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="Link title" value={newLink.label} onChange={(e) => setNewLink((p) => ({ ...p, label: e.target.value }))} />
            <input className={inputCls} placeholder="paste URL" value={newLink.url} onChange={(e) => setNewLink((p) => ({ ...p, url: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addLink()} />
          </div>
          <button onClick={addLink} disabled={!newLink.label.trim() || !newLink.url.trim()} className="rd-btn rd-btn-ghost-d text-[13px] w-full py-2 disabled:opacity-40">+ Add link</button>
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
        preview={
          <div className="w-[236px] rounded-[26px] overflow-hidden shadow-2xl" style={{ background: "#191a1a" }}>
            {/* Hero */}
            <div className="relative w-full aspect-square overflow-hidden">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(160deg,#181538,#2A2466 60%,#4338ca)" }}>
                  <span className="text-white/90 font-extrabold text-5xl">{initials}</span>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none" style={{ background: "linear-gradient(180deg,rgba(25,26,26,0),#191a1a)" }} />
            </div>
            {/* Sheet */}
            <div className="relative -mt-6 rounded-t-[22px] px-4 pt-4 pb-6 text-center" style={{ background: "#191a1a" }}>
              <div className="flex items-center justify-center gap-1">
                <p className="text-white font-extrabold text-[19px] leading-tight truncate">{name || "Your Name"}</p>
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0"><path d="M12 1.5l2.35 2.03 3.08-.45 1.07 2.92 2.92 1.07-.45 3.08L23 12l-2.03 2.35.45 3.08-2.92 1.07-1.07 2.92-3.08-.45L12 23l-2.35-2.03-3.08.45-1.07-2.92-2.92-1.07.45-3.08L1 12l2.03-2.35-.45-3.08 2.92-1.07 1.07-2.92 3.08.45L12 1.5z" fill="#2196F3" /><path d="M7.5 12.2l3 3 6-6.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              </div>
              <p className="text-white/45 text-[12px]">@{handle}</p>
              {business && <p className="text-white/55 text-[11px] font-medium mt-1.5">{business}</p>}
              {bio && <p className="text-white/75 text-[11.5px] leading-snug mt-2 line-clamp-3">{bio}</p>}
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
              {links.length > 0 && (
                <div className="mt-3 space-y-2">
                  {links.slice(0, 3).map((l, i) => (
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
        }
      />
    </>
  );
}
