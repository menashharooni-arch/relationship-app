"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import LogoSuggest from "@/components/LogoSuggest";
import EnablePushButton from "@/components/EnablePushButton";
import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import CustomCard, { DEFAULT_CUSTOM_LAYOUT } from "@/components/card-templates/CustomCard";
import CustomCardDesigner from "@/components/CustomCardDesigner";
import TemplateStyleControls from "@/components/card-templates/TemplateStyleControls";
import AddressInput, { EMPTY_ADDRESS } from "@/components/AddressInput";
import { withoutSocials } from "@/components/card-templates/types";
import type { TemplateStyle } from "@/components/card-templates/shared";
import type { CardAddress, CardData, CardLink, CardPhone, PhoneLabel, CustomLayout } from "@/components/card-templates/types";
import { socialUrl } from "@/lib/social-url";
import { useGuestDraft, saveDraft } from "@/lib/guest-draft";
import { consumePrefill } from "@/lib/prefill";
import GuestGateModal from "@/components/GuestGateModal";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Turn whatever the user types (a URL, an @handle, or a bare handle) into a clean,
// linkable value so the card can connect to the account automatically.
function normalizeSocial(raw: string, key: SocialKey): string {
  const v = raw.trim();
  if (!v) return "";
  const urlLike = key === "linkedin" || key === "youtube" || key === "facebook";
  try {
    if (v.includes("://") || v.includes(".")) {
      const url = new URL(v.includes("://") ? v : `https://${v}`);
      const parts = url.pathname.split("/").filter(Boolean);
      if (key === "linkedin") return parts.length ? `linkedin.com/${parts.join("/")}` : v;
      if (key === "youtube") return parts.length ? `youtube.com/${parts.join("/")}` : v;
      if (key === "facebook") return parts.length ? `facebook.com/${parts.join("/")}` : v;
      const handle = parts[parts.length - 1]?.replace(/^@/, "");
      if (handle) return `@${handle}`;
    }
  } catch {
    /* not a URL — fall through */
  }
  if (urlLike) return v;
  return v.startsWith("@") ? v : `@${v.replace(/^@/, "")}`;
}

type SocialKey = "linkedin" | "instagram" | "tiktok" | "facebook" | "twitter" | "snapchat" | "youtube";

const SOCIALS: { key: SocialKey; label: string; placeholder: string }[] = [
  { key: "linkedin",  label: "LinkedIn",    placeholder: "linkedin.com/in/you" },
  { key: "instagram", label: "Instagram",   placeholder: "@username or profile URL" },
  { key: "tiktok",    label: "TikTok",      placeholder: "@username" },
  { key: "facebook",  label: "Facebook",    placeholder: "facebook.com/you" },
  { key: "twitter",   label: "X (Twitter)", placeholder: "@username" },
  { key: "snapchat",  label: "Snapchat",    placeholder: "@username" },
  { key: "youtube",   label: "YouTube",     placeholder: "youtube.com/@you" },
];

// For these URL-style networks, show the exact format to copy so the link works.
const SOCIAL_FORMATS: Partial<Record<SocialKey, string>> = {
  linkedin: "linkedin.com/in/yourfullname",
  facebook: "facebook.com/yourfullname",
  youtube: "youtube.com/@yourchannel",
};

type Socials = Record<SocialKey, string>;
const EMPTY_SOCIALS: Socials = {
  linkedin: "", instagram: "", tiktok: "", facebook: "", twitter: "", snapchat: "", youtube: "",
};


const TEMPLATES = [
  { id: "classic-pro",    label: "Classic Pro",    Component: ClassicPro },
  { id: "modern-bold",    label: "Modern Bold",    Component: ModernBold },
  { id: "photo-first",    label: "Photo First",    Component: PhotoFirst },
  { id: "local-business", label: "Local Business", Component: LocalBusiness },
  { id: "luxury-minimal", label: "Luxury Minimal", Component: LuxuryMinimal },
];

const inputCls =
  "w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors";

// Guest mode: a signed-out visitor can build a full card without an account. The
// server wrapper (cards/new/page.tsx) passes guest={!user}. Every change is
// snapshotted to a localStorage draft; the "Create card" action is gated behind
// auth (requireAuth) and the draft is claimed → real card after they sign in.
export default function NewCardWizard({ isPro, guest = false }: { isPro: boolean; guest?: boolean }) {
  const router = useRouter();
  // Only requireAuth from the hook (stable). Autosave uses the raw debounced
  // saveDraft so it never triggers a setState → re-render → save loop.
  const { requireAuth } = useGuestDraft();
  const [step, setStep] = useState(1);

  // Advancing (or going back) a step should start the user at the top of the
  // new step. Defer to the next frame so the new content is laid out first, and
  // jump instantly — mobile browsers can drop a smooth scroll issued mid-render.
  useEffect(() => {
    const id = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
    return () => cancelAnimationFrame(id);
  }, [step]);

  // Step 1 — card details
  const [nickname, setNickname] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [phones, setPhones] = useState<CardPhone[]>([{ number: "", label: "mobile", showOnCard: true }]);
  const [fax, setFax] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<Required<CardAddress>>(EMPTY_ADDRESS);

  // Step 2 — bio, social links, additional links
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [links, setLinks] = useState<CardLink[]>([]);
  const [newLink, setNewLink] = useState({ label: "", url: "" });
  const [socials, setSocials] = useState<Socials>(EMPTY_SOCIALS);

  // Step 3 — media + design
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [template, setTemplate] = useState("classic-pro");
  const [customLayout, setCustomLayout] = useState<CustomLayout>(DEFAULT_CUSTOM_LAYOUT);
  // Preset-template styling (Pro). All fields optional → template defaults apply.
  const [templateStyleState, setTemplateStyleState] = useState<TemplateStyle>({});
  function patchTemplateStyle(patch: Partial<TemplateStyle>) {
    setTemplateStyleState((prev) => ({ ...prev, ...patch }));
  }

  // Autofill from a homepage "mini builder": if the visitor sketched a card /
  // SwiftLink / signature on the marketing site and hit "Make it live", carry
  // everything they typed into the wizard. Consumed once, then cleared.
  useEffect(() => {
    const p = consumePrefill();
    if (!p) return;
    if (p.name) setName(p.name);
    if (p.title) setTitle(p.title);
    if (p.company) setCompany(p.company);
    if (p.email) setEmail(p.email);
    if (p.phone) setPhones([{ number: p.phone, label: "mobile", showOnCard: true }]);
    if (p.address) setAddress((prev) => ({ ...prev, ...p.address }));
    if (p.bio) setBio(p.bio);
    if (p.website) setWebsite(p.website);
    if (p.socials) setSocials((prev) => ({ ...prev, ...p.socials }));
    if (p.links?.length) setLinks(p.links.map((l) => ({ label: l.label, url: l.url })));
    if (p.template) setTemplate(p.template);
    if (p.accentColor) setTemplateStyleState((prev) => ({ ...prev, accentColor: p.accentColor }));
    if (p.logoUrl) setLogoUrl(p.logoUrl);
    if (p.headshotUrl) setHeadshotUrl(p.headshotUrl);
    if (p.step) setStep(Math.min(Math.max(p.step, 1), 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  // Card URL auto-fills from full name + company (e.g. "john-smith-acme-corp"),
  // or just the full name when there's no company.
  const username = slugify(company.trim() ? `${name} ${company}` : name);
  const cardLabel = nickname.trim() || name.trim();

  // Phone management (multiple numbers, each labeled + toggleable on the card).
  function updatePhone(i: number, patch: Partial<CardPhone>) {
    setPhones((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function addPhone() {
    setPhones((prev) => [...prev, { number: "", label: "office", showOnCard: true }]);
  }
  function removePhone(i: number) {
    setPhones((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }
  const cleanPhones: CardPhone[] = phones
    .filter((p) => p.number.trim())
    .map((p) => ({ number: p.number.trim(), label: p.label, showOnCard: p.showOnCard }));
  const primaryPhone =
    (cleanPhones.find((p) => p.showOnCard) ?? cleanPhones[0])?.number ?? "";

  function setSocial(key: SocialKey, value: string) {
    setSocials((prev) => ({ ...prev, [key]: value }));
  }
  function normalizeOnBlur(key: SocialKey) {
    setSocials((prev) => ({ ...prev, [key]: normalizeSocial(prev[key], key) }));
  }

  const atLinkCap = false; // Free now gets unlimited Swift Links buttons.
  function addLink() {
    if (atLinkCap) return;
    const label = newLink.label.trim();
    let url = newLink.url.trim();
    if (!label || !url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    // Add, then reset the fields so another link can be entered right away.
    setLinks((prev) => [...prev, { label, url }]);
    setNewLink({ label: "", url: "" });
  }
  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function goNextFrom1() {
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!username) {
      setError("Please enter a name we can turn into a URL.");
      return;
    }
    setError("");
    setStep(2);
  }

  const previewData: CardData = {
    name: name || "Your name",
    title,
    company,
    phone: primaryPhone,
    email,
    website: "",
    linkedin: socials.linkedin,
    instagram: socials.instagram,
    twitter: socials.twitter,
    tiktok: socials.tiktok,
    snapchat: socials.snapchat,
    initials: (name || "?")[0]?.toUpperCase() ?? "?",
    photoUrl: headshotUrl,
    logoUrl,
    cardUrl: `swiftcard.me/card/${username || "your-card"}`,
    address: [
      [address.street, address.unit ? `Unit ${address.unit}` : ""].filter(Boolean).join(", "),
      address.city,
      [address.state, address.zip].filter(Boolean).join(" "),
    ].filter(Boolean).join("\n"),
    customization: { snapchat: socials.snapchat, customLayout, phones: cleanPhones, fax: fax.trim(), ...templateStyleState },
  };
  const PreviewTemplate = template === "custom" ? CustomCard : (TEMPLATES.find((t) => t.id === template)?.Component ?? ClassicPro);
  const customSelected = template === "custom";

  // Guest autosave: snapshot the exact shape we'd POST to /api/cards into the
  // localStorage draft on every change. The claim route mirrors /api/cards'
  // allow-list, so extra keys are harmless and missing ones default. Logo +
  // headshot ride in `images` as data URLs (guest can't upload) and are pushed to
  // storage + rewritten to real URLs at claim time. saveDraft is debounced.
  useEffect(() => {
    if (!guest) return;
    saveDraft({
      step,
      payload: {
        username, label: cardLabel, name, company, title,
        phone: primaryPhone, email, website,
        linkedin: socials.linkedin, instagram: socials.instagram,
        tiktok: socials.tiktok, twitter: socials.twitter,
        template,
        logo_url: null,
        customization: {
          bio, facebook: socials.facebook, snapchat: socials.snapchat,
          youtube: socials.youtube, links, address, phones: cleanPhones, fax: fax.trim(),
          ...templateStyleState,
          photoUrl: null,
          ...(template === "custom" ? { customLayout } : {}),
        },
      },
      images: {
        ...(logoUrl ? { logo: logoUrl } : {}),
        ...(headshotUrl ? { photo: headshotUrl } : {}),
      },
    });
  }, [guest, step, username, cardLabel, name, company, title, primaryPhone, email, website,
      socials, template, bio, links, address, cleanPhones, fax, templateStyleState,
      customLayout, logoUrl, headshotUrl]);

  async function handleCreate() {
    if (!name.trim() || !username) {
      setStep(1);
      setError("Full name is required.");
      return;
    }
    setStatus("loading");
    setError("");

    let res: Response;
    try {
      res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          label: cardLabel,
          name: name.trim(),
          company: company.trim(),
          title: title.trim(),
          phone: primaryPhone,
          email: email.trim(),
          website: website.trim(),
          linkedin: socials.linkedin.trim(),
          instagram: socials.instagram.trim(),
          tiktok: socials.tiktok.trim(),
          twitter: socials.twitter.trim(),
          template,
          logo_url: logoUrl,
          customization: {
            bio: bio.trim(),
            facebook: socials.facebook.trim(),
            snapchat: socials.snapchat.trim(),
            youtube: socials.youtube.trim(),
            links,
            address,
            phones: cleanPhones,
            fax: fax.trim(),
            // Preset-template style overrides (Pro; stripped server-side on Free).
            // Only fields the user actually set are present here.
            ...templateStyleState,
            // Headshot is per-card (explicit key, null when none) — never inherits
            // another card's photo.
            photoUrl: headshotUrl ?? null,
            ...(template === "custom" ? { customLayout } : {}),
          },
        }),
      });
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
      setStatus("error");
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === "limit" || data.error === "upgrade") {
        router.push("/pricing");
        return;
      }
      setError(data.error || "Something went wrong.");
      setStatus("error");
      return;
    }

    // Card created — last step: turn on notifications for this card so the
    // owner gets contact alerts + view milestones on their device.
    setStatus("idle");
    setStep(4);
  }

  return (
    <>
    <main className="sc-app min-h-screen bg-gray-950 px-5 py-10">
      <div className="max-w-sm mx-auto">
        <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm transition-colors flex items-center gap-1.5 mb-8">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Dashboard
        </Link>

        {/* Step indicator (hidden on the post-create success screen) */}
        {step <= 3 && (
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors"
                  style={{ background: step >= n ? "#2563eb" : "#1f2937", color: step >= n ? "#fff" : "#6b7280" }}
                >
                  {n}
                </div>
                {n < 3 && <div className="flex-1 h-px" style={{ background: step > n ? "#2563eb" : "#1f2937" }} />}
              </div>
            ))}
          </div>
        )}

        {/* Step 1 — card details */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="mb-1">
              <h1 className="text-2xl font-bold text-white">New card</h1>
              <p className="text-gray-400 text-sm mt-1">Start with the basics.</p>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-blue-800/40 bg-blue-950/30 px-3.5 py-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={1.8} className="w-4 h-4 shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <p className="text-blue-200/90 text-xs leading-relaxed">
                You only need to fill out the fields marked with a red asterisk <span className="text-red-500 font-semibold">*</span> — but for the best results, fill out everything you can.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Card nickname</label>
              <input type="text" placeholder="e.g. Sales Card" value={nickname} onChange={(e) => setNickname(e.target.value)} className={inputCls} />
              <p className="text-gray-600 text-xs mt-1">A label shown on your dashboard so you can tell your cards apart.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Full name <span className="text-red-500">*</span></label>
              <input type="text" placeholder="John Smith" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Company name</label>
              <input type="text" placeholder="Acme Corp" value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} />
              <p className="text-gray-600 text-xs mt-1">Card URL: /card/{username || "your-name"}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Job title</label>
              <input type="text" placeholder="Sales Director" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-400">Phone numbers</label>
                <button type="button" onClick={addPhone} className="text-xs font-semibold text-blue-400 hover:text-blue-300">+ Add number</button>
              </div>
              <div className="space-y-2">
                {phones.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={p.label}
                      onChange={(e) => updatePhone(i, { label: e.target.value as PhoneLabel })}
                      className="bg-gray-900 border border-gray-700 text-gray-200 rounded-xl px-2 py-3 text-sm focus:outline-none focus:border-blue-500 shrink-0"
                    >
                      <option value="mobile">Mobile</option>
                      <option value="office">Office</option>
                    </select>
                    <input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={p.number}
                      onChange={(e) => updatePhone(i, { number: e.target.value })}
                      className={`${inputCls} flex-1 min-w-0`}
                    />
                    <button
                      type="button"
                      onClick={() => updatePhone(i, { showOnCard: !p.showOnCard })}
                      title={p.showOnCard ? "Showing on card" : "Hidden from card"}
                      className={`shrink-0 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${p.showOnCard ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-900 border-gray-700 text-gray-500"}`}
                    >
                      {p.showOnCard ? "On card ✓" : "Off card"}
                    </button>
                    {phones.length > 1 && (
                      <button type="button" onClick={() => removePhone(i)} className="shrink-0 text-gray-600 hover:text-red-400 px-1 text-lg leading-none" aria-label="Remove number">×</button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-gray-600 text-xs mt-1.5">Label each number and pick which ones appear on your card (you can show more than one).</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input type="email" placeholder="john@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>

            <AddressInput value={address} onChange={setAddress} />

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Fax number <span className="text-gray-600 font-normal">· shows on your card only</span>
              </label>
              <input type="tel" placeholder="+1 (555) 000-0000" value={fax} onChange={(e) => setFax(e.target.value)} className={inputCls} />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button onClick={goNextFrom1} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-full transition-colors text-sm mt-2">
              Next: Socials →
            </button>
          </div>
        )}

        {/* Step 2 — bio, social links, additional links */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="mb-1">
              <h1 className="text-2xl font-bold text-white">Swift Links</h1>
              <p className="text-gray-400 text-sm mt-1">Your bio, social profiles, and extra links. All optional.</p>
            </div>

            {/* Swiftlinks bio */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-400">Swiftlinks bio</label>
                <span className="text-[10px] font-semibold text-blue-400">Tip: be descriptive</span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="e.g. Austin realtor helping first-time buyers find their dream home — 10+ years, 200+ closings. Let's talk!"
                className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
              <p className="text-gray-600 text-[11px] mt-1">
                Shows at the top of your Swift Links — the first thing visitors read. Say <strong className="text-gray-400">who you help, what you do, and why they should reach out</strong>. Descriptive bios get more taps.
              </p>
            </div>

            {/* Social links — website first */}
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1">Social links</p>
              <p className="text-gray-600 text-[11px] mb-3">Paste a profile URL or type an @handle — we link it automatically.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Website</label>
                  <input
                    type="text"
                    placeholder="yoursite.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className={inputCls}
                  />
                </div>
                {SOCIALS.map(({ key, label, placeholder }) => {
                  const linked = socials[key].trim().length > 0;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs text-gray-500">{label}</label>
                        {linked && socialUrl(key, socials[key]) && (
                          <a href={socialUrl(key, socials[key])!} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" /></svg>
                            Open link
                          </a>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder={placeholder}
                        value={socials[key]}
                        onChange={(e) => setSocial(key, e.target.value)}
                        onBlur={() => normalizeOnBlur(key)}
                        className={inputCls}
                      />
                      {SOCIAL_FORMATS[key] && (
                        <p className="text-gray-600 text-[11px] mt-1">
                          Copy this exact format: <span className="text-gray-400 font-medium">{SOCIAL_FORMATS[key]}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-gray-800" />

            {/* Additional links */}
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1">Additional links</p>
              <p className="text-gray-600 text-[11px] mb-3">Add your links — can be a review page, recent video, listing, etc.</p>
              {links.length > 0 && (
                <div className="space-y-2 mb-2">
                  {links.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-200 text-xs font-semibold truncate">{l.label}</p>
                        <p className="text-gray-500 text-[10px] truncate">{l.url}</p>
                      </div>
                      <button type="button" onClick={() => removeLink(i)} className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none shrink-0">×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Link name (e.g. Leave a review)"
                  value={newLink.label}
                  onChange={(e) => setNewLink((n) => ({ ...n, label: e.target.value }))}
                  className={inputCls}
                />
                <input
                  type="text"
                  placeholder="https://…"
                  value={newLink.url}
                  onChange={(e) => setNewLink((n) => ({ ...n, url: e.target.value }))}
                  className={inputCls}
                />
                {(() => {
                  const readyToAdd = !atLinkCap && !!newLink.label.trim() && !!newLink.url.trim();
                  return (
                    <button
                      type="button"
                      onClick={addLink}
                      disabled={!readyToAdd}
                      className={`w-full text-xs font-semibold py-2.5 rounded-xl transition-colors ${
                        readyToAdd
                          ? "sc-btn-glow bg-blue-600 hover:bg-blue-500 text-white border border-blue-500"
                          : "border border-dashed border-gray-700 text-gray-400 disabled:opacity-40"
                      }`}
                    >
                      + Add link
                    </button>
                  );
                })()}
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-700 text-gray-400 hover:border-gray-500 font-semibold py-3 rounded-full transition-colors text-sm">
                ← Back
              </button>
              <button onClick={() => setStep(3)} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-full transition-colors text-sm">
                Next: Logo & design →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — card created: turn on notifications for this card */}
        {step === 4 && (
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700/40 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Your card is live! 🎉</h1>
              <p className="text-blue-400 text-sm mt-1 font-mono">swiftcard.me/card/{username}</p>
            </div>

            <div className="rounded-2xl border border-blue-800/40 bg-blue-950/30 px-4 py-4 text-center">
              <p className="text-blue-200 font-semibold text-sm">🔔 Press here to turn on notifications</p>
              <p className="text-blue-300/80 text-xs mt-1.5 leading-relaxed">
                Get an instant alert the moment someone shares their info through your card.
              </p>
            </div>

            <EnablePushButton />

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
            >
              Continue to dashboard →
            </button>
          </div>
        )}

        {/* Step 3 — media + design */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="mb-1">
              <h1 className="text-2xl font-bold text-white">Photos & design</h1>
              <p className="text-gray-400 text-sm mt-1">Add your logo and headshot, then pick a design.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Company logo</label>
              <ImageUpload field="logo" currentUrl={logoUrl} label="Upload your company logo" shape="square" defer guest={guest} onUploaded={(url) => setLogoUrl(url || null)} />
              {/* Suggest an official company logo (Agent 4 contract). Fails safe —
                  renders nothing when the provider isn't configured. */}
              <LogoSuggest company={company} email={email} onConfirm={(url) => setLogoUrl(url || null)} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Headshot</label>
              <ImageUpload
                field="photo"
                currentUrl={headshotUrl}
                label="Upload your headshot"
                hint="Recommended. This will also be used for your SwiftLink."
                shape="circle"
                defer
                guest={guest}
                onUploaded={(url) => setHeadshotUrl(url || null)}
              />
            </div>

            {/* Design */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Choose your design</label>

              {/* Preview (or custom designer when custom + Pro) */}
              {customSelected && isPro ? (
                <div className="mb-3">
                  <CustomCardDesigner layout={customLayout} data={previewData} onChange={setCustomLayout} />
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-gray-800 mb-3">
                  {/* Scale from the 460px natural width (same as the published
                      card) so a long name/title/company never clips in-preview. */}
                  <CardScaler>
                    <PreviewTemplate data={customSelected ? previewData : withoutSocials(previewData)} />
                  </CardScaler>
                </div>
              )}

              {/* Custom design — first option */}
              <button
                type="button"
                onClick={() => { if (isPro) setTemplate("custom"); }}
                disabled={!isPro}
                className="w-full flex items-center justify-between text-xs font-semibold py-2.5 px-3 rounded-xl border transition-colors disabled:opacity-60 mb-2"
                style={{
                  background: customSelected ? "#1D4ED8" : "#111827",
                  borderColor: customSelected ? "#1D4ED8" : "#374151",
                  color: customSelected ? "#fff" : "#9ca3af",
                }}
              >
                <span>
                  Custom design
                  <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white">PRO</span>
                </span>
                <span>{customSelected ? "Selected" : isPro ? "Select" : "🔒"}</span>
              </button>
              {!isPro && (
                <Link href="/pricing" className="block text-center text-[11px] text-blue-400 hover:text-blue-300 mb-2">
                  Upgrade to Pro to design your own card →
                </Link>
              )}

              {/* Standard templates */}
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTemplate(id)}
                    className="text-xs font-semibold py-2 rounded-xl border transition-colors"
                    style={{
                      background: template === id ? "#1D4ED8" : "#111827",
                      borderColor: template === id ? "#1D4ED8" : "#374151",
                      color: template === id ? "#fff" : "#9ca3af",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Restyle the chosen preset — colors & typography (Pro) */}
              {!customSelected && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-400">
                      Customize colors &amp; font
                      <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white">PRO</span>
                    </label>
                  </div>
                  <TemplateStyleControls value={templateStyleState} onChange={patchTemplateStyle} locked={!isPro} />
                  {!isPro && (
                    <Link href="/pricing" className="block text-center text-[11px] text-blue-400 hover:text-blue-300 mt-2">
                      Unlock custom colors &amp; fonts with Pro →
                    </Link>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 mt-1">
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-700 text-gray-400 hover:border-gray-500 font-semibold py-3 rounded-full transition-colors text-sm">
                ← Back
              </button>
              <button
                onClick={() => requireAuth("save", handleCreate)}
                disabled={status === "loading"}
                className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
              >
                {status === "loading" ? "Creating…" : "Create card →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
    {/* Self-contained auth gate — the useGuestDraft hook opens it via a window
        event when a guest triggers a protected action. */}
    <GuestGateModal />
    </>
  );
}
