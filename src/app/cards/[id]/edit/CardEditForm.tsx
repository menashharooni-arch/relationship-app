"use client";

// Editing a card is organized into three tabs — Content, Design, Sharing —
// with a live card preview pinned alongside (right on desktop, top on mobile),
// so every change is visible immediately. Same fields, labels, and save
// behavior as before; only the layout changed from a 3-step wizard to tabs.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import LogoSuggest from "@/components/LogoSuggest";
import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import CustomCard, { DEFAULT_CUSTOM_LAYOUT } from "@/components/card-templates/CustomCard";
import CustomCardDesigner from "@/components/CustomCardDesigner";
import CustomDesignCard from "@/components/CustomDesignCard";
import TemplateStyleControls from "@/components/card-templates/TemplateStyleControls";
import AddressInput, { EMPTY_ADDRESS } from "@/components/AddressInput";
import { withoutSocials } from "@/components/card-templates/types";
import type { TemplateStyle } from "@/components/card-templates/shared";
import type { CardAddress, CardData, CardLink, CardPhone, PhoneLabel, CustomLayout } from "@/components/card-templates/types";
import { socialUrl, normalizeSocial, SOCIAL_FORMATS } from "@/lib/social-url";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

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

const TEMPLATES = [
  { id: "classic-pro",    label: "Classic Pro",    Component: ClassicPro },
  { id: "modern-bold",    label: "Modern Bold",    Component: ModernBold },
  { id: "photo-first",    label: "Photo First",    Component: PhotoFirst },
  { id: "local-business", label: "Local Business", Component: LocalBusiness },
  { id: "luxury-minimal", label: "Luxury Minimal", Component: LuxuryMinimal },
];

const inputCls =
  "w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors";

type TabId = "content" | "design" | "sharing";
const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "content", label: "Content", hint: "Name, contact details & photos" },
  { id: "design", label: "Design", hint: "Template, colors & fonts" },
  { id: "sharing", label: "Sharing", hint: "Your Swift Links page" },
];

const sectionLabel = "text-xs font-semibold text-gray-400 uppercase tracking-wider";

type Card = {
  id: string;
  username: string;
  label?: string;
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  linkedin: string;
  instagram: string;
  twitter: string;
  tiktok: string;
  template: string;
  customization?: { bio?: string; facebook?: string; snapchat?: string; youtube?: string; about?: string; address?: CardAddress; links?: CardLink[]; customLayout?: CustomLayout; phones?: CardPhone[]; fax?: string; accentColor?: string; bgColor?: string; textColor?: string; fontFamily?: string };
};

type Props = { card: Card; photoUrl?: string | null; logoUrl?: string | null; isPro?: boolean; isPrimary?: boolean };

// Note: editing is auth-only — a guest has no existing card to edit — so per the
// guest-auth-flow contract no useGuestDraft/requireAuth wiring is needed here.
// Guest mode lives in NewCardWizard.

export default function CardEditForm({ card, photoUrl, logoUrl: initialLogoUrl, isPro = false, isPrimary = false }: Props) {
  const saveUrl = isPrimary ? "/api/profile" : `/api/cards/${card.id}`;
  const logoCardId = isPrimary ? undefined : card.id;
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("content");

  // On tab change, jump the editor column back to the top. Defer to the next
  // frame and jump instantly — mobile browsers can drop a smooth scroll issued
  // mid-render.
  useEffect(() => {
    const id = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
    return () => cancelAnimationFrame(id);
  }, [tab]);

  // Content — card details
  const [label, setLabel] = useState(card.label || "");
  const [name, setName] = useState(card.name || "");
  const [company, setCompany] = useState(card.company || "");
  const [title, setTitle] = useState(card.title || "");
  const [phones, setPhones] = useState<CardPhone[]>(
    card.customization?.phones?.length
      ? card.customization.phones
      : card.phone
      ? [{ number: card.phone, label: "mobile", showOnCard: true }]
      : [{ number: "", label: "mobile", showOnCard: true }]
  );
  const [fax, setFax] = useState(card.customization?.fax || "");
  const [email, setEmail] = useState(card.email || "");
  const [address, setAddress] = useState<Required<CardAddress>>({ ...EMPTY_ADDRESS, ...(card.customization?.address ?? {}) });

  // Sharing — bio, social links, additional links
  const [bio, setBio] = useState(card.customization?.bio || "");
  const [website, setWebsite] = useState(card.website || "");
  const [links, setLinks] = useState<CardLink[]>(card.customization?.links ?? []);
  const [newLink, setNewLink] = useState({ label: "", url: "" });
  const [socials, setSocials] = useState<Record<SocialKey, string>>({
    linkedin:  card.linkedin || "",
    instagram: card.instagram || "",
    tiktok:    card.tiktok || "",
    facebook:  card.customization?.facebook || "",
    twitter:   card.twitter || "",
    snapchat:  card.customization?.snapchat || "",
    youtube:   card.customization?.youtube || "",
  });

  // Content — media; Design — template + style
  const [cardLogoUrl, setCardLogoUrl] = useState<string | null>(initialLogoUrl ?? null);
  const [photoState, setPhotoState] = useState<string | null>(photoUrl ?? null);
  const [template, setTemplate] = useState(card.template || "classic-pro");
  const [customLayout, setCustomLayout] = useState<CustomLayout>(card.customization?.customLayout ?? DEFAULT_CUSTOM_LAYOUT);
  // Preset-template styling (Pro). Undefined fields fall back to each template's
  // baked-in design, so a card saved before this feature is unchanged.
  const [templateStyleState, setTemplateStyleState] = useState<TemplateStyle>({
    accentColor: card.customization?.accentColor ?? undefined,
    bgColor: card.customization?.bgColor ?? undefined,
    textColor: card.customization?.textColor ?? undefined,
    fontFamily: card.customization?.fontFamily ?? undefined,
  });
  function patchTemplateStyle(patch: Partial<TemplateStyle>) {
    setTemplateStyleState((prev) => ({ ...prev, ...patch }));
  }

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

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
    const linkLabel = newLink.label.trim();
    let url = newLink.url.trim();
    if (!linkLabel || !url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    // Add the link, then reset the fields so another can be entered right away.
    setLinks((prev) => [...prev, { label: linkLabel, url }]);
    setNewLink({ label: "", url: "" });
  }
  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  const previewData: CardData = {
    name: name || card.username,
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
    initials: (name || card.username)[0]?.toUpperCase() ?? "?",
    photoUrl: photoState,
    logoUrl: cardLogoUrl,
    cardUrl: `swiftcard.me/card/${card.username}`,
    address: [
      [address.street, address.unit ? `Unit ${address.unit}` : ""].filter(Boolean).join(", "),
      address.city,
      [address.state, address.zip].filter(Boolean).join(" "),
    ].filter(Boolean).join("\n"),
    customization: { snapchat: socials.snapchat, customLayout, phones: cleanPhones, fax: fax.trim(), ...templateStyleState },
  };
  const PreviewTemplate = template === "custom" ? CustomCard : (TEMPLATES.find((t) => t.id === template)?.Component ?? ClassicPro);
  const customSelected = template === "custom";

  async function handleSave() {
    if (!name.trim()) {
      setTab("content");
      setError("Full name is required.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const res = await fetch(saveUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim(),
          title: title.trim(),
          email: email.trim(),
          website: website.trim(),
          linkedin: normalizeSocial(socials.linkedin, "linkedin"),
          instagram: normalizeSocial(socials.instagram, "instagram"),
          twitter: normalizeSocial(socials.twitter, "twitter"),
          tiktok: normalizeSocial(socials.tiktok, "tiktok"),
          phone: primaryPhone,
          ...(isPrimary ? {} : { label }),
          template,
          customization: {
            bio: bio.trim(),
            facebook: normalizeSocial(socials.facebook, "facebook"),
            snapchat: normalizeSocial(socials.snapchat, "snapchat"),
            youtube: normalizeSocial(socials.youtube, "youtube"),
            address,
            links,
            customLayout,
            phones: cleanPhones,
            fax: fax.trim(),
            // Preset-template style overrides (Pro; stripped server-side on Free).
            // Sent explicitly (undefined → key cleared to the template default).
            accentColor: templateStyleState.accentColor ?? null,
            bgColor: templateStyleState.bgColor ?? null,
            textColor: templateStyleState.textColor ?? null,
            fontFamily: templateStyleState.fontFamily ?? null,
            // Headshot is per-card (explicit key, null when removed).
            photoUrl: photoState ?? null,
          },
          logo_url: cardLogoUrl,
        }),
      });
      if (res.ok) {
        setStatus("saved");
        // Show the "Saved" confirmation briefly, then return to the dashboard.
        setTimeout(() => { router.push("/dashboard"); }, 1000);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2500);
      }
    } catch {
      // Network failure — don't leave the button stuck on "Saving…".
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  }

  const saveLabel =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved!" : status === "error" ? "Error — try again" : "Save changes";

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:items-start">
      {/* ── EDITOR (left on desktop, below the preview on mobile) ── */}
      <div className="min-w-0 order-2 lg:order-1">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-2">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors ${on ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="text-gray-600 text-[11px] mb-5">{TABS.find((t) => t.id === tab)?.hint}</p>

        {/* ── CONTENT ── */}
        {tab === "content" && (
          <div className="space-y-4">
            {!isPrimary && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Card nickname</label>
                <input type="text" placeholder="e.g. Sales Card" value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
                <p className="text-gray-600 text-xs mt-1">A label shown on your dashboard so you can tell your cards apart.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Full name <span className="text-red-500">*</span></label>
              <input type="text" placeholder="John Smith" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Company name</label>
              <input type="text" placeholder="Acme Corp" value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} />
              <p className="text-gray-600 text-xs mt-1">Card URL: /card/{card.username}</p>
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

            {/* Photos */}
            <div className="border-t border-gray-800 pt-4 mt-2 space-y-4">
              <p className={sectionLabel}>Photos</p>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Company logo</label>
                <ImageUpload field="logo" currentUrl={cardLogoUrl} label="Upload your company logo" shape="square" cardId={logoCardId} onUploaded={(url) => setCardLogoUrl(url || null)} />
                <LogoSuggest company={company} email={email} onConfirm={(url) => setCardLogoUrl(url || null)} />
                {!isPrimary && <p className="text-[11px] text-gray-600 mt-1">Per-card logo (different from your profile logo)</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Headshot</label>
                <ImageUpload
                  field="photo"
                  currentUrl={photoState}
                  label="Upload your headshot"
                  hint="Recommended. This will also be used for your SwiftLink."
                  shape="circle"
                  defer
                  onUploaded={(url) => setPhotoState(url || null)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── DESIGN ── */}
        {tab === "design" && (
          <div className="space-y-4">
            {/* Custom designer is the editing surface for the custom template */}
            {customSelected && isPro && (
              <div>
                <p className={`${sectionLabel} mb-2`}>Custom layout</p>
                <CustomCardDesigner layout={customLayout} data={previewData} onChange={setCustomLayout} />
              </div>
            )}

            <div>
              <p className={`${sectionLabel} mb-2`}>Template</p>
              {/* Custom design — the freeform "edit every element" path */}
              <div className="mb-2">
                <CustomDesignCard isPro={isPro} selected={customSelected} onSelect={() => setTemplate("custom")} />
              </div>

              {/* Standard templates */}
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map(({ id, label: tplLabel }) => (
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
                    {tplLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Restyle the chosen preset — colors & typography (Pro) */}
            {!customSelected && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className={sectionLabel}>
                    Customize colors &amp; font
                    <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white">PRO</span>
                  </p>
                </div>
                <TemplateStyleControls value={templateStyleState} onChange={patchTemplateStyle} template={template} locked={!isPro} />
                {!isPro && (
                  <Link href="/pricing" className="block text-center text-[11px] text-blue-400 hover:text-blue-300 mt-2">
                    Unlock custom colors &amp; fonts with Pro →
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SHARING (Swift Links page) ── */}
        {tab === "sharing" && (
          <div className="space-y-5">
            <div className="flex items-start gap-2.5 rounded-xl border border-blue-800/40 bg-blue-950/30 px-3.5 py-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={1.8} className="w-4 h-4 shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              <p className="text-blue-200/90 text-xs leading-relaxed">These appear on your <strong>Swift Links</strong> page (your link-in-bio), not on the business card.</p>
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
                className={`${inputCls} resize-none`}
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
                  <input type="text" placeholder="yoursite.com" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} />
                </div>
                {SOCIALS.map(({ key, label: socialLabel, placeholder }) => {
                  const linked = socials[key].trim().length > 0;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs text-gray-500">{socialLabel}</label>
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
          </div>
        )}

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Link href="/dashboard" className="flex-1 text-center border border-gray-700 text-gray-400 hover:border-gray-500 font-semibold py-3 rounded-full transition-colors text-sm">
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={status === "saving"}
            className="flex-[2] font-semibold py-3 rounded-full transition-colors text-sm text-white disabled:opacity-50"
            style={{ background: status === "saved" ? "#16a34a" : "#2563eb" }}
          >
            {saveLabel}
          </button>
        </div>
      </div>

      {/* ── LIVE PREVIEW (right on desktop / top on mobile, pinned) ── */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Live preview</p>
          <a href={`${APP_URL}/card/${card.username}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:text-blue-300">View live →</a>
        </div>
        <div className="rounded-2xl overflow-hidden border border-gray-800">
          {/* Scale from the 460px natural width (same as the published card) so a
              long name/title/company never clips in-preview. */}
          <CardScaler>
            <PreviewTemplate data={customSelected ? previewData : withoutSocials(previewData)} />
          </CardScaler>
        </div>
        {tab === "sharing" ? (
          <p className="text-gray-600 text-[11px] mt-2 leading-snug">Editing your <span className="text-gray-400">Swift Links</span> page — the card above only shows your name, title & contact details.</p>
        ) : (
          <p className="text-gray-600 text-[11px] mt-2 leading-snug">Your changes appear here instantly.</p>
        )}
      </div>
    </div>
  );
}
