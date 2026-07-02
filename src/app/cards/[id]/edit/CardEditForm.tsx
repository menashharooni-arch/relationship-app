"use client";

// Editing a card walks through the SAME 3-step flow as creating one:
// Step 1 — card details, Step 2 — Swift Links (bio/socials/links),
// Step 3 — photos & design. Same fields, same order, same labels as
// NewCardWizard — the only differences are prefilled values and "Save
// changes" instead of "Create card".

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import CustomCard, { DEFAULT_CUSTOM_LAYOUT } from "@/components/card-templates/CustomCard";
import CustomCardDesigner from "@/components/CustomCardDesigner";
import AddressInput, { EMPTY_ADDRESS } from "@/components/AddressInput";
import { PLAN_LIMITS } from "@/lib/plan";
import { withoutSocials } from "@/components/card-templates/types";
import type { CardAddress, CardData, CardLink, CardPhone, PhoneLabel, CustomLayout } from "@/components/card-templates/types";
import { socialUrl, normalizeSocial, SOCIAL_FORMATS } from "@/lib/social-url";

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

const LINK_EMOJIS = ["🔗", "🌐", "📅", "⭐", "🎥", "🏠", "💼", "📋", "📸", "🎵", "💸", "📄"];

const TEMPLATES = [
  { id: "classic-pro",    label: "Classic Pro",    Component: ClassicPro },
  { id: "modern-bold",    label: "Modern Bold",    Component: ModernBold },
  { id: "photo-first",    label: "Photo First",    Component: PhotoFirst },
  { id: "local-business", label: "Local Business", Component: LocalBusiness },
  { id: "luxury-minimal", label: "Luxury Minimal", Component: LuxuryMinimal },
];

const inputCls =
  "w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors";

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
  customization?: { bio?: string; facebook?: string; snapchat?: string; youtube?: string; about?: string; address?: CardAddress; links?: CardLink[]; customLayout?: CustomLayout; phones?: CardPhone[]; fax?: string };
};

type Props = { card: Card; photoUrl?: string | null; logoUrl?: string | null; isPro?: boolean; isPrimary?: boolean };

export default function CardEditForm({ card, photoUrl, logoUrl: initialLogoUrl, isPro = false, isPrimary = false }: Props) {
  const saveUrl = isPrimary ? "/api/profile" : `/api/cards/${card.id}`;
  const logoCardId = isPrimary ? undefined : card.id;
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — card details
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

  // Step 2 — bio, social links, additional links
  const [bio, setBio] = useState(card.customization?.bio || "");
  const [website, setWebsite] = useState(card.website || "");
  const [links, setLinks] = useState<CardLink[]>(card.customization?.links ?? []);
  const [newLink, setNewLink] = useState({ label: "", url: "", emoji: "🔗" });
  const [socials, setSocials] = useState<Record<SocialKey, string>>({
    linkedin:  card.linkedin || "",
    instagram: card.instagram || "",
    tiktok:    card.tiktok || "",
    facebook:  card.customization?.facebook || "",
    twitter:   card.twitter || "",
    snapchat:  card.customization?.snapchat || "",
    youtube:   card.customization?.youtube || "",
  });

  // Step 3 — media + design
  const [cardLogoUrl, setCardLogoUrl] = useState<string | null>(initialLogoUrl ?? null);
  const [photoState, setPhotoState] = useState<string | null>(photoUrl ?? null);
  const [template, setTemplate] = useState(card.template || "classic-pro");
  const [customLayout, setCustomLayout] = useState<CustomLayout>(card.customization?.customLayout ?? DEFAULT_CUSTOM_LAYOUT);

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

  const atLinkCap = !isPro && links.length >= PLAN_LIMITS.FREE_SWIFTLINK_BUTTONS;
  function addLink() {
    if (atLinkCap) return;
    const linkLabel = newLink.label.trim();
    let url = newLink.url.trim();
    if (!linkLabel || !url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setLinks((prev) => [...prev, { emoji: newLink.emoji || "🔗", label: linkLabel, url }]);
    setNewLink({ label: "", url: "", emoji: "🔗" });
  }
  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function goNextFrom1() {
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    setError("");
    setStep(2);
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
    customization: { snapchat: socials.snapchat, customLayout, phones: cleanPhones, fax: fax.trim() },
  };
  const PreviewTemplate = template === "custom" ? CustomCard : (TEMPLATES.find((t) => t.id === template)?.Component ?? ClassicPro);
  const customSelected = template === "custom";

  async function handleSave() {
    if (!name.trim()) {
      setStep(1);
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
          },
          logo_url: cardLogoUrl,
        }),
      });
      if (res.ok) {
        setStatus("saved");
        setTimeout(() => { setStatus("idle"); router.refresh(); }, 1800);
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
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => setStep(n)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors"
              style={{ background: step >= n ? "#2563eb" : "#1f2937", color: step >= n ? "#fff" : "#6b7280" }}
            >
              {n}
            </button>
            {n < 3 && <div className="flex-1 h-px" style={{ background: step > n ? "#2563eb" : "#1f2937" }} />}
          </div>
        ))}
      </div>

      {/* Step 1 — card details */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="mb-1">
            <h2 className="text-2xl font-bold text-white">Card details</h2>
            <p className="text-gray-400 text-sm mt-1">Update the basics.</p>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-blue-800/40 bg-blue-950/30 px-3.5 py-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={1.8} className="w-4 h-4 shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p className="text-blue-200/90 text-xs leading-relaxed">
              You only need to fill out the fields marked with a red asterisk <span className="text-red-500 font-semibold">*</span> — but for the best results, fill out everything you can.
            </p>
          </div>

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
            <h2 className="text-2xl font-bold text-white">Swift Links</h2>
            <p className="text-gray-400 text-sm mt-1">Your bio, social profiles, and extra links. All optional.</p>
          </div>

          {/* Swiftlinks bio */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Swiftlinks bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="A little about yourself or what you do…"
              className={`${inputCls} resize-none`}
            />
            <p className="text-gray-600 text-[11px] mt-1">Shows at the top of your Swift Links — add a bit about yourself or what you do.</p>
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
                    <span className="text-base shrink-0">{l.emoji}</span>
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
              {/* Emoji picker */}
              <div className="flex flex-wrap gap-1.5">
                {LINK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setNewLink((n) => ({ ...n, emoji: em }))}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border transition-colors ${newLink.emoji === em ? "border-blue-500 bg-blue-600/20" : "border-gray-700 bg-gray-900 hover:border-gray-600"}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
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
              <button
                type="button"
                onClick={addLink}
                disabled={atLinkCap || !newLink.label.trim() || !newLink.url.trim()}
                className="w-full border border-dashed border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40 text-xs font-medium py-2.5 rounded-xl transition-colors"
              >
                + Add link
              </button>
              {atLinkCap && (
                <p className="text-[11px] text-blue-400 text-center">
                  Free includes {PLAN_LIMITS.FREE_SWIFTLINK_BUTTONS} buttons — <Link href="/pricing" className="underline hover:text-blue-300">upgrade to Pro</Link> for unlimited.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <button onClick={() => setStep(1)} className="flex-1 border border-gray-700 text-gray-400 hover:border-gray-500 font-semibold py-3 rounded-full transition-colors text-sm">
              ← Back
            </button>
            <button onClick={() => setStep(3)} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-full transition-colors text-sm">
              Next: Logo &amp; design →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — media + design */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="mb-1">
            <h2 className="text-2xl font-bold text-white">Photos &amp; design</h2>
            <p className="text-gray-400 text-sm mt-1">Add your logo and headshot, then pick a design.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Company logo</label>
            <ImageUpload field="logo" currentUrl={cardLogoUrl} label="Upload your company logo" shape="square" cardId={logoCardId} onUploaded={(url) => setCardLogoUrl(url || null)} />
            {!isPrimary && <p className="text-[11px] text-gray-600 mt-1">Per-card logo (different from your profile logo)</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Headshot</label>
            <ImageUpload field="photo" currentUrl={photoState} label="Upload your headshot" shape="circle" onUploaded={(url) => setPhotoState(url || null)} />
            <p className="text-[11px] text-gray-600 mt-1">Your headshot is shared across all your cards.</p>
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
                <PreviewTemplate data={customSelected ? previewData : withoutSocials(previewData)} />
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

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 mt-1">
            <button onClick={() => setStep(2)} className="flex-1 border border-gray-700 text-gray-400 hover:border-gray-500 font-semibold py-3 rounded-full transition-colors text-sm">
              ← Back
            </button>
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
      )}

      {/* Editing an existing card: allow saving from any step without walking
          through the rest of the flow. */}
      {step < 3 && (
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="w-full mt-3 py-3 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50"
          style={{
            background: status === "saved" ? "#16a34a" : "transparent",
            borderColor: status === "saved" ? "#16a34a" : "#374151",
            color: status === "saved" ? "#fff" : "#9ca3af",
          }}
        >
          {saveLabel}
        </button>
      )}
    </div>
  );
}
