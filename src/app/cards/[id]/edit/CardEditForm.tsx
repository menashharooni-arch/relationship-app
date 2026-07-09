"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import Link from "next/link";

const SOCIAL_KEYS = new Set(["linkedin", "instagram", "tiktok", "facebook", "twitter", "snapchat", "youtube"]);

const LINK_PRESETS: { emoji: string; label: string }[] = [
  { emoji: "📅", label: "Book a call" },
  { emoji: "🌐", label: "Visit website" },
  { emoji: "💼", label: "View portfolio" },
  { emoji: "⭐", label: "Leave a review" },
  { emoji: "💸", label: "Pay me" },
  { emoji: "📋", label: "View menu" },
  { emoji: "📄", label: "Download" },
  { emoji: "🎥", label: "Watch video" },
];

const TEMPLATES = [
  { id: "classic-pro",     name: "Classic Professional", Component: ClassicPro },
  { id: "modern-bold",     name: "Modern Bold",          Component: ModernBold },
  { id: "photo-first",     name: "Photo First",          Component: PhotoFirst },
  { id: "local-business",  name: "Local Business",       Component: LocalBusiness },
  { id: "luxury-minimal",  name: "Luxury Minimal",       Component: LuxuryMinimal },
] as const;

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

const FIELDS = [
  { key: "name",      label: "Full name",   placeholder: "John Smith",           required: true },
  { key: "title",     label: "Job title",   placeholder: "Sales Director",       required: false },
  { key: "company",   label: "Company",     placeholder: "Acme Corp",            required: false },
  { key: "phone",     label: "Phone",       placeholder: "+1 (555) 000-0000",    required: false },
  { key: "email",     label: "Email",       placeholder: "john@company.com",     required: false },
  { key: "website",   label: "Website",     placeholder: "www.company.com",      required: false },
  { key: "linkedin",  label: "LinkedIn",    placeholder: "linkedin.com/in/john", required: false },
  { key: "instagram", label: "Instagram",   placeholder: "@john",                required: false },
  { key: "tiktok",    label: "TikTok",      placeholder: "@john",                required: false },
  { key: "facebook",  label: "Facebook",    placeholder: "facebook.com/john",    required: false },
  { key: "twitter",   label: "X (Twitter)", placeholder: "@john",                required: false },
  { key: "snapchat",  label: "Snapchat",    placeholder: "@john",                required: false },
  { key: "youtube",   label: "YouTube",     placeholder: "youtube.com/@john",    required: false },
];

type Props = { card: Card; photoUrl?: string | null; logoUrl?: string | null; isPro?: boolean; isPrimary?: boolean };

export default function CardEditForm({ card, photoUrl, logoUrl: initialLogoUrl, isPro = false, isPrimary = false }: Props) {
  const saveUrl = isPrimary ? "/api/profile" : `/api/cards/${card.id}`;
  const logoCardId = isPrimary ? undefined : card.id;
  const router = useRouter();
  const [form, setForm] = useState({
    name:      card.name || "",
    title:     card.title || "",
    company:   card.company || "",
    email:     card.email || "",
    website:   card.website || "",
    linkedin:  card.linkedin || "",
    instagram: card.instagram || "",
    twitter:   card.twitter || "",
    tiktok:    card.tiktok || "",
    facebook:  card.customization?.facebook || "",
    snapchat:  card.customization?.snapchat || "",
    youtube:   card.customization?.youtube || "",
  });
  const [label, setLabel] = useState(card.label || "");
  const [bio, setBio] = useState(card.customization?.bio || "");
  const [address, setAddress] = useState<Required<CardAddress>>({ ...EMPTY_ADDRESS, ...(card.customization?.address ?? {}) });
  const [links, setLinks] = useState<CardLink[]>(card.customization?.links ?? []);
  const [phones, setPhones] = useState<CardPhone[]>(
    card.customization?.phones?.length
      ? card.customization.phones
      : card.phone
      ? [{ number: card.phone, label: "mobile", showOnCard: true }]
      : [{ number: "", label: "mobile", showOnCard: true }]
  );
  const [fax, setFax] = useState(card.customization?.fax || "");
  const atLinkCap = !isPro && links.length >= PLAN_LIMITS.FREE_SWIFTLINK_BUTTONS;
  const [addingLink, setAddingLink] = useState(false);
  const [newLink, setNewLink] = useState<CardLink>({ emoji: "🌐", label: "", url: "" });
  const [cardLogoUrl, setCardLogoUrl] = useState<string | null>(initialLogoUrl ?? null);
  const [photoState, setPhotoState] = useState<string | null>(photoUrl ?? null);
  const [template, setTemplate] = useState(card.template || "classic-pro");
  const [customLayout, setCustomLayout] = useState<CustomLayout>(card.customization?.customLayout ?? DEFAULT_CUSTOM_LAYOUT);
  const [tab, setTab] = useState<"info" | "design">("info");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

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
  const primaryPhone = (cleanPhones.find((p) => p.showOnCard) ?? cleanPhones[0])?.number ?? "";

  const previewData: CardData = {
    name:      form.name || card.username,
    title:     form.title,
    company:   form.company,
    phone:     primaryPhone,
    email:     form.email,
    website:   form.website,
    linkedin:  form.linkedin,
    instagram: form.instagram,
    twitter:   form.twitter,
    tiktok:    form.tiktok,
    initials:  (form.name || card.username)[0]?.toUpperCase() ?? "?",
    photoUrl:  photoState ?? null,
    logoUrl:   cardLogoUrl ?? null,
    cardUrl:   `swiftcard.me/card/${card.username}`,
    address: [
      [address.street, address.unit ? `Unit ${address.unit}` : ""].filter(Boolean).join(", "),
      address.city,
      [address.state, address.zip].filter(Boolean).join(" "),
    ].filter(Boolean).join("\n"),
    customization: { customLayout, phones: cleanPhones, fax: fax.trim() },
  };

  const ActiveTemplate = template === "custom" ? CustomCard : (TEMPLATES.find((t) => t.id === template)?.Component ?? ClassicPro);

  function addLink() {
    if (atLinkCap) return;
    if (!newLink.label.trim() || !newLink.url.trim()) return;
    const url = newLink.url.startsWith("http") ? newLink.url : `https://${newLink.url}`;
    setLinks((prev) => [...prev, { ...newLink, url }]);
    setNewLink({ emoji: "🌐", label: "", url: "" });
    setAddingLink(false);
  }

  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setStatus("saving");
    const { snapchat: _snap, youtube: _yt, facebook: _fb, ...coreForm } = form;
    // Normalize every social to a clean, linkable value so the saved links resolve.
    const n = (k: string, v: string) => normalizeSocial(v, k);
    try {
      const res = await fetch(saveUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...coreForm,
          linkedin: n("linkedin", form.linkedin),
          instagram: n("instagram", form.instagram),
          twitter: n("twitter", form.twitter),
          tiktok: n("tiktok", form.tiktok),
          phone: primaryPhone,
          ...(isPrimary ? {} : { label }),
          template,
          customization: { bio, facebook: n("facebook", form.facebook), snapchat: n("snapchat", form.snapchat), youtube: n("youtube", form.youtube), address, links, customLayout, phones: cleanPhones, fax: fax.trim() },
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

  return (
    <div className="space-y-6">
      {/* Live preview */}
      <div className="rounded-2xl overflow-hidden border border-gray-800">
        <ActiveTemplate data={template === "custom" ? previewData : withoutSocials(previewData)} />
      </div>

      {/* Tab bar */}
      <div className="flex bg-gray-900 rounded-xl p-1 gap-1">
        {(["info", "design"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: tab === t ? "#1D4ED8" : "transparent",
              color: tab === t ? "#fff" : "#6b7280",
            }}
          >
            {t === "info" ? "Card info" : "Design"}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {tab === "info" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Card logo</label>
            <ImageUpload
              field="logo"
              currentUrl={cardLogoUrl}
              label="Company logo"
              shape="square"
              cardId={logoCardId}
              onUploaded={(url) => setCardLogoUrl(url || null)}
            />
            <p className="text-[11px] text-gray-600 mt-1">Per-card logo (different from your profile logo)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Headshot</label>
            <ImageUpload
              field="photo"
              currentUrl={photoState}
              label="Your headshot"
              shape="circle"
              onUploaded={(url) => setPhotoState(url || null)}
            />
            <p className="text-[11px] text-gray-600 mt-1">Shared across all your cards.</p>
          </div>
          {!isPrimary && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Card nickname</label>
              <input
                type="text"
                placeholder="e.g. Sales Card"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-[11px] text-gray-600 mt-1">Shown on your dashboard to identify this card.</p>
            </div>
          )}
          {FIELDS.map((f) => {
            if (f.key === "phone") {
              return (
                <div key="phone">
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
                          className="flex-1 min-w-0 bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
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
                  <p className="text-gray-600 text-xs mt-1.5">Label each number and pick which appear on your card (you can show more than one).</p>
                </div>
              );
            }
            const isSocial = SOCIAL_KEYS.has(f.key);
            const val = (form[f.key as keyof typeof form] ?? "") as string;
            const linkHref = (isSocial || f.key === "website") ? socialUrl(f.key, val) : null;
            return (
              <div key={f.key}>
                {f.key === "linkedin" && (
                  <p className="text-gray-600 text-[11px] mb-2 leading-relaxed">
                    Paste a profile URL or type an @handle — we link it automatically. Tap <span className="text-blue-400 font-medium">Open</span> to test that a link goes to the right place.
                  </p>
                )}
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-400">{f.label}</label>
                  {linkHref && (
                    <a href={linkHref} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" /></svg>
                      Open
                    </a>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={f.placeholder}
                  required={f.required}
                  value={val}
                  onChange={(e) => set(f.key, e.target.value)}
                  onBlur={isSocial ? (e) => set(f.key, normalizeSocial(e.target.value, f.key)) : undefined}
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
                {isSocial && SOCIAL_FORMATS[f.key] && (
                  <p className="text-gray-600 text-[11px] mt-1">
                    Copy this exact format: <span className="text-gray-400 font-medium">{SOCIAL_FORMATS[f.key]}</span>
                  </p>
                )}
              </div>
            );
          })}
          <AddressInput value={address} onChange={setAddress} />

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Fax number <span className="text-gray-600 font-normal">· shows on your card only</span>
            </label>
            <input
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={fax}
              onChange={(e) => setFax(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Swiftlinks bio */}
          <div className="pt-1">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Swiftlinks bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="A little about yourself or what you do…"
              className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
            <p className="text-[11px] text-gray-600 mt-1">Shows at the top of your Swift Links.</p>
          </div>

          {/* Additional links */}
          <div className="pt-1">
            <p className="text-xs font-medium text-gray-400 mb-0.5">Additional links</p>
            <p className="text-gray-600 text-[11px] mb-2">Add your links — a review page, recent video, listing, etc.</p>
            {links.length > 0 && (
              <div className="space-y-2 mb-2">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5">
                    <span className="text-base shrink-0">{link.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 text-xs font-semibold truncate">{link.label}</p>
                      <p className="text-gray-500 text-[10px] truncate">{link.url}</p>
                    </div>
                    <button type="button" onClick={() => removeLink(i)} className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                  </div>
                ))}
              </div>
            )}
            {addingLink ? (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {LINK_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setNewLink((n) => ({ ...n, emoji: p.emoji, label: p.label }))}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-colors"
                      style={{
                        background: newLink.label === p.label ? "#1e3a5f" : "#1f2937",
                        borderColor: newLink.label === p.label ? "#3b82f6" : "#374151",
                        color: newLink.label === p.label ? "#60a5fa" : "#6b7280",
                      }}
                    >
                      {p.emoji} {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="📅"
                    value={newLink.emoji}
                    onChange={(e) => setNewLink((n) => ({ ...n, emoji: e.target.value }))}
                    className="w-12 bg-gray-900 border border-gray-600 text-white rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Button label"
                    value={newLink.label}
                    onChange={(e) => setNewLink((n) => ({ ...n, label: e.target.value }))}
                    className="flex-1 bg-gray-900 border border-gray-600 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <input
                  type="text"
                  placeholder="https://calendly.com/yourname"
                  value={newLink.url}
                  onChange={(e) => setNewLink((n) => ({ ...n, url: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-600 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={addLink} disabled={!newLink.label.trim() || !newLink.url.trim()}
                    className="flex-1 bg-blue-600 disabled:opacity-40 text-white text-xs font-bold py-2 rounded-lg">
                    Add link
                  </button>
                  <button type="button" onClick={() => { setAddingLink(false); setNewLink({ emoji: "🌐", label: "", url: "" }); }}
                    className="px-3 text-xs text-gray-500 hover:text-gray-300">
                    Cancel
                  </button>
                </div>
              </div>
            ) : atLinkCap ? (
              <div className="border border-dashed border-blue-800/50 bg-blue-950/30 rounded-xl py-3 px-4 text-center">
                <p className="text-blue-200 text-xs">Free includes {PLAN_LIMITS.FREE_SWIFTLINK_BUTTONS} Swift Links buttons.</p>
                <a href="/pricing" className="inline-block mt-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300">Upgrade to Pro for unlimited →</a>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingLink(true)}
                className="w-full border border-dashed border-gray-700 text-gray-600 hover:border-blue-500 hover:text-blue-400 text-xs font-medium py-2.5 rounded-xl transition-colors">
                + Add link
              </button>
            )}
          </div>
        </div>
      )}

      {/* Design tab */}
      {tab === "design" && (
        <div className="space-y-4">
          {/* Custom design — Pro (first option) */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">
                Custom design
                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white align-middle">PRO</span>
              </span>
              <button
                type="button"
                onClick={() => { if (isPro) setTemplate("custom"); }}
                disabled={!isPro}
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full disabled:opacity-50"
                style={{ background: template === "custom" ? "#1D4ED8" : "#1f2937", color: template === "custom" ? "#fff" : "#6b7280" }}
              >
                {template === "custom" ? "Selected" : "Select"}
              </button>
            </div>

            {!isPro ? (
              <div className="rounded-2xl border border-dashed border-gray-700 p-5 text-center">
                <p className="text-gray-300 text-sm font-medium mb-1">Design your own card</p>
                <p className="text-gray-600 text-xs mb-3">Place your logo, headshot, text and socials anywhere. Choose fonts and colors.</p>
                <Link href="/pricing" className="inline-block text-xs font-semibold text-blue-400 hover:text-blue-300">Upgrade to Pro →</Link>
              </div>
            ) : template === "custom" ? (
              <div
                className="rounded-2xl"
                style={{ outline: "3px solid #3b82f6", outlineOffset: 3, boxShadow: "0 0 0 5px rgba(59,130,246,0.12)" }}
              >
                <CustomCardDesigner layout={customLayout} data={previewData} onChange={setCustomLayout} />
              </div>
            ) : (
              <button type="button" onClick={() => setTemplate("custom")} className="w-full text-left">
                <div className="rounded-2xl overflow-hidden border border-gray-800">
                  <CustomCard data={previewData} />
                </div>
              </button>
            )}
          </div>

          {TEMPLATES.map(({ id, name, Component }) => (
            <button
              key={id}
              onClick={() => setTemplate(id)}
              className="w-full text-left outline-none"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">{name}</span>
                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  style={{
                    background: template === id ? "#1D4ED8" : "#1f2937",
                    color: template === id ? "#fff" : "#6b7280",
                  }}
                >
                  {template === id ? "Selected" : "Select"}
                </span>
              </div>
              <div
                className="rounded-2xl transition-all"
                style={{
                  outline: template === id ? "3px solid #3b82f6" : "2px solid transparent",
                  outlineOffset: 3,
                  boxShadow: template === id ? "0 0 0 5px rgba(59,130,246,0.12)" : undefined,
                }}
              >
                <Component data={withoutSocials(previewData)} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={status === "saving"}
        className="w-full py-3 rounded-full text-sm font-bold transition-all"
        style={{
          background: status === "saved" ? "#16a34a" : "#1D4ED8",
          color: "#fff",
          opacity: status === "saving" ? 0.6 : 1,
        }}
      >
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved!" : status === "error" ? "Error — try again" : "Save changes"}
      </button>
    </div>
  );
}
