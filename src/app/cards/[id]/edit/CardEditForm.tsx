"use client";

// Editing a card is organized into four tabs — Card info, Card design,
// Socials, Social design — the same four sections (and order) as the new-card
// wizard, with a live card preview pinned alongside (right on desktop, top on
// mobile) so every change is visible immediately.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLink from "@/components/DashboardLink";
import { PlanGate } from "@/components/PlanGate";
import { PLAN_LIMITS } from "@/lib/plan";
import ImageUpload from "@/components/ImageUpload";
import LogoSuggest from "@/components/LogoSuggest";
import ProfilePhotoSuggest from "@/components/ProfilePhotoSuggest";
import CardScaler from "@/components/CardScaler";
import InertPreview from "@/components/InertPreview";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import CustomCard, { DEFAULT_CUSTOM_LAYOUT } from "@/components/card-templates/CustomCard";
import CustomCardDesigner from "@/components/CustomCardDesigner";
import CustomDesignCard from "@/components/CustomDesignCard";
import TemplateStyleControls from "@/components/card-templates/TemplateStyleControls";
import { SwiftLinkStyleControls, SwiftLinkPagePreview, type SwiftLinkStyle } from "@/components/SwiftLinkDesign";
import AddressInput, { EMPTY_ADDRESS } from "@/components/AddressInput";
import { withoutSocials } from "@/components/card-templates/types";
import type { TemplateStyle } from "@/components/card-templates/shared";
import type { CardAddress, CardData, CardLink, CardPhone, PhoneLabel, CustomLayout } from "@/components/card-templates/types";
import { socialUrl, normalizeSocial, SOCIAL_FORMATS } from "@/lib/social-url";
import LinkPreviewThumb from "@/components/LinkPreviewThumb";
import CardUrlEditor from "@/components/CardUrlEditor";


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

// The same four sections as the new-card wizard, in the same order:
// 1 Card information · 2 Card design · 3 Socials · 4 Social design.
type TabId = "content" | "design" | "sharing" | "linkdesign";
const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "content", label: "Card info", hint: "Name & contact details" },
  { id: "design", label: "Card design", hint: "Photos, template, colors & fonts" },
  { id: "sharing", label: "Socials", hint: "Bio, socials & additional links" },
  { id: "linkdesign", label: "Social design", hint: "Style your Swift Links page" },
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
  customization?: { bio?: string; facebook?: string; snapchat?: string; youtube?: string; about?: string; address?: CardAddress; links?: CardLink[]; customLayout?: CustomLayout; phones?: CardPhone[]; fax?: string; accentColor?: string; bgColor?: string; textColor?: string; infoColor?: string; fontFamily?: string; linkBgColor?: string; linkTextColor?: string; linkFontFamily?: string };
};

// Company information owned by the user's Office organization (sub-users only).
// Any field the office set is shown read-only under "Managed by your
// organization"; a field the office left blank stays editable. `lockDesign`
// mirrors the office's Lock Card Design setting and freezes the Design tab.
export type OrgManaged = {
  company: string | null;
  website: string | null;
  logoUrl: string | null;
  phone: string | null;
  fax: string | null;
  address: CardAddress | null;
  lockDesign: boolean;
  // True when the viewer is the office OWNER editing one of their NON-primary
  // cards (which inherits the brand). Changes the copy from "managed by your
  // organization" to "set on your office's Branding page".
  ownerInherited?: boolean;
};

type Props = { card: Card; photoUrl?: string | null; logoUrl?: string | null; isPro?: boolean; isPrimary?: boolean; org?: OrgManaged | null; linkedinEnabled?: boolean };

// Small "who owns this field" tag shown next to org-controlled values.
function ManagedTag({ owner }: { owner?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/25 rounded-full px-2 py-0.5">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
      {owner ? "From your Branding page" : "Managed by your organization"}
    </span>
  );
}

// Note: editing is auth-only — a guest has no existing card to edit — so per the
// guest-auth-flow contract no useGuestDraft/requireAuth wiring is needed here.
// Guest mode lives in NewCardWizard.

export default function CardEditForm({ card, photoUrl, logoUrl: initialLogoUrl, isPro = false, isPrimary = false, org = null, linkedinEnabled = false }: Props) {
  const saveUrl = isPrimary ? "/api/profile" : `/api/cards/${card.id}`;
  const logoCardId = isPrimary ? undefined : card.id;
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("content");

  // Org-managed fields (office sub-users). Each flag is per-field: the office
  // manages exactly what it has set; blanks stay in the employee's hands.
  const orgCompany = org?.company?.trim() || null;
  const orgWebsite = org?.website?.trim() || null;
  const orgLogo = org?.logoUrl || null;
  const orgPhone = org?.phone?.trim() || null;
  const orgFax = org?.fax?.trim() || null;
  const orgAddress = org?.address && Object.values(org.address).some((v) => (v ?? "").toString().trim()) ? org.address : null;
  const designLocked = !!org?.lockDesign;

  // On tab change, jump the editor column back to the top. Defer to the next
  // frame and jump instantly — mobile browsers can drop a smooth scroll issued
  // mid-render.
  useEffect(() => {
    const id = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
    return () => cancelAnimationFrame(id);
  }, [tab]);

  // Content — card details. Org-managed fields initialize FROM the org so the
  // saved payload always matches the organization's current values, even if
  // this card hadn't been re-synced yet.
  const [label, setLabel] = useState(orgCompany ?? (card.label || ""));
  const [name, setName] = useState(card.name || "");
  const [company, setCompany] = useState(orgCompany ?? (card.company || ""));
  const [title, setTitle] = useState(card.title || "");
  // The office phone rides in `phones` as a server-injected `office:true` entry.
  // Sub-users edit only their own numbers — the office entry is filtered out
  // here (shown read-only in the company panel) and re-applied on save.
  const initialPhones = (card.customization?.phones ?? []).filter((p) => !(orgPhone && (p as { office?: boolean }).office));
  const [phones, setPhones] = useState<CardPhone[]>(
    initialPhones.length
      ? initialPhones
      : card.phone && card.phone !== orgPhone
      ? [{ number: card.phone, label: "mobile", showOnCard: true }]
      : [{ number: "", label: "mobile", showOnCard: true }]
  );
  const [fax, setFax] = useState(orgFax ?? (card.customization?.fax || ""));
  const [email, setEmail] = useState(card.email || "");
  const [address, setAddress] = useState<Required<CardAddress>>({ ...EMPTY_ADDRESS, ...(orgAddress ?? card.customization?.address ?? {}) });

  // Sharing — bio, social links, additional links
  const [bio, setBio] = useState(card.customization?.bio || "");
  const [website, setWebsite] = useState(orgWebsite ?? (card.website || ""));
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
    infoColor: card.customization?.infoColor ?? undefined,
    fontFamily: card.customization?.fontFamily ?? undefined,
  });
  function patchTemplateStyle(patch: Partial<TemplateStyle>) {
    setTemplateStyleState((prev) => ({ ...prev, ...patch }));
  }
  // "Social design" — the Swift Links PAGE's look. Separate keys from the
  // card's style, so styling one surface never restyles the other.
  const [linkStyleState, setLinkStyleState] = useState<SwiftLinkStyle>({
    linkBgColor: card.customization?.linkBgColor ?? undefined,
    linkTextColor: card.customization?.linkTextColor ?? undefined,
    linkFontFamily: card.customization?.linkFontFamily ?? undefined,
  });
  function patchLinkStyle(patch: Partial<SwiftLinkStyle>) {
    setLinkStyleState((prev) => ({ ...prev, ...patch }));
  }

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  // Set when the save is rejected because this is a non-primary card that is
  // view-only on Free (api/cards/[id] → error:"view_only" / code:"CARD_VIEW_ONLY").
  // Previously this had no proper surface; now web shows the message + an
  // Upgrade link and native shows the neutral PlanGate string.
  const [viewOnly, setViewOnly] = useState(false);

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

  // Free is limited to FREE_MAX_LINKS Swift Links; Pro/Office get unlimited.
  const atLinkCap = !isPro && links.length >= PLAN_LIMITS.FREE_MAX_LINKS;
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
    customization: {
      snapchat: socials.snapchat,
      customLayout,
      // Preview mirrors the live card: the office number the server injects on
      // every connected card is shown here too, ahead of personal numbers.
      phones: org && orgPhone
        ? [{ number: orgPhone, label: "office" as PhoneLabel, showOnCard: true }, ...cleanPhones]
        : cleanPhones,
      fax: fax.trim(),
      ...templateStyleState,
    },
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
    setViewOnly(false);
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
            infoColor: templateStyleState.infoColor ?? null,
            fontFamily: templateStyleState.fontFamily ?? null,
            // Swift Links page design ("Social design" — Pro, stripped on Free).
            linkBgColor: linkStyleState.linkBgColor ?? null,
            linkTextColor: linkStyleState.linkTextColor ?? null,
            linkFontFamily: linkStyleState.linkFontFamily ?? null,
            // Headshot is per-card (explicit key, null when removed).
            photoUrl: photoState ?? null,
          },
          logo_url: cardLogoUrl,
        }),
      });
      if (res.ok) {
        setStatus("saved");
        // Show the "Saved" confirmation briefly, then return to THIS card's
        // dashboard (not the bare picker).
        setTimeout(() => { router.push(`/dashboard?card=${encodeURIComponent(card.username)}`); }, 1000);
      } else {
        // Surface the server's plain-English reason when it gives one (e.g. an
        // org-managed field was changed) instead of a bare "Error".
        const json = await res.json().catch(() => ({} as { message?: string; error?: string; code?: string }));
        if (json.error === "view_only" || json.code === "CARD_VIEW_ONLY") setViewOnly(true);
        if (typeof json.message === "string" && json.message) setError(json.message);
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
                // text-[11px] on phones: four tabs share the row now, and
                // "Social design" must never clip inside its pill.
                className={`flex-1 text-[11px] sm:text-sm leading-tight font-semibold py-2 px-0.5 rounded-lg transition-colors ${on ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
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
            {/* Company information — office sub-users see the org-owned half of
                their card here, read-only. Fields the office set never render as
                inputs below; whatever it left blank stays editable. */}
            {org && (orgCompany || orgWebsite || orgPhone || orgFax || orgAddress || orgLogo) && (
              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className={sectionLabel}>Company information</p>
                  <ManagedTag owner={org.ownerInherited} />
                </div>
                <p className="text-gray-500 text-xs mb-3">
                  {org.ownerInherited
                    ? "These are set on your office's Branding page and appear on every card on your team — yours included."
                    : "Your organization keeps these details up to date on every connected card."}
                </p>
                <dl className="space-y-1.5">
                  {orgLogo && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-gray-500 text-xs">Company logo</dt>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <dd><img src={orgLogo} alt="Company logo" className="w-8 h-8 rounded-lg object-cover bg-gray-900" /></dd>
                    </div>
                  )}
                  {([
                    orgCompany && { k: "Card nickname", v: orgCompany },
                    orgCompany && { k: "Company name", v: orgCompany },
                    orgPhone && { k: "Office phone", v: orgPhone },
                    orgFax && { k: "Fax", v: orgFax },
                    orgAddress && {
                      k: "Address",
                      v: [orgAddress.street, orgAddress.unit, orgAddress.city, orgAddress.state, orgAddress.zip]
                        .filter((v) => (v ?? "").toString().trim()).join(", "),
                    },
                    orgWebsite && { k: "Website", v: orgWebsite },
                  ].filter(Boolean) as { k: string; v: string }[]).map((b) => (
                    <div key={b.k} className="flex items-center justify-between gap-3">
                      <dt className="text-gray-500 text-xs shrink-0">{b.k}</dt>
                      <dd className="text-gray-300 text-xs font-medium truncate">{b.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {org && <p className={sectionLabel}>Your information</p>}

            {!isPrimary && !(org && orgCompany) && (
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
            {!(org && orgCompany) && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Company name</label>
                <input type="text" placeholder="Acme Corp" value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} />
                <CardUrlEditor cardId={card.id} currentSlug={card.username} suggested={company.trim() ? `${name} ${company}` : name} />
              </div>
            )}
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
              {org && orgPhone && (
                <p className="text-gray-500 text-xs mt-1">
                  Your office number ({orgPhone}) is added to your card automatically by your organization.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input type="email" placeholder="john@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>

            {!(org && orgAddress) && <AddressInput value={address} onChange={setAddress} />}

            {!(org && orgFax) && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Fax number <span className="text-gray-600 font-normal">· shows on your card only</span>
                </label>
                <input type="tel" placeholder="+1 (555) 000-0000" value={fax} onChange={(e) => setFax(e.target.value)} className={inputCls} />
              </div>
            )}

          </div>
        )}

        {/* ── CARD DESIGN — photos + template + colors (matches the wizard's
            step 2). Photos stay editable even under an office design lock:
            the lock covers template/colors, never someone's own headshot. ── */}
        {tab === "design" && (
          <div className="space-y-4">
            {/* Photos */}
            <div className="space-y-4">
              <p className={sectionLabel}>Photos</p>
              {/* Company logo is editable only on a NON-office card. Every card
                  under an office (org set — employee or owner alike) inherits
                  the brand logo, which is set on the office Branding page; the
                  upload is hidden here so a manual change can't be attempted
                  and silently reverted. */}
              {!org && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Company logo</label>
                  <ImageUpload field="logo" currentUrl={cardLogoUrl} label="Upload your company logo" shape="square" cardId={logoCardId} onUploaded={(url) => setCardLogoUrl(url || null)} />
                  <LogoSuggest company={company} email={email} onConfirm={(url) => setCardLogoUrl(url || null)} />
                  {!isPrimary && <p className="text-[11px] text-gray-600 mt-1">Per-card logo (different from your profile logo)</p>}
                </div>
              )}
              {org && !orgLogo && (
                <p className="text-[11px] text-gray-500">
                  {org.ownerInherited
                    ? "Your company logo is set on your office's Branding page — add it there and it appears on every card."
                    : "Your company logo is managed by your organization."}
                </p>
              )}
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
                <ProfilePhotoSuggest
                  linkedinEnabled={linkedinEnabled}
                  returnTo={`/cards/${card.id}/edit`}
                  onConfirm={(url) => setPhotoState(url)}
                />
              </div>
            </div>

            {/* Template + colors — locked for sub-users while the office's Lock
                Card Design setting is on. The server rejects locked-design
                writes regardless; this just makes the rule visible. */}
            {designLocked ? (
              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className={sectionLabel}>Card design</p>
                  <ManagedTag />
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Your organization keeps every card matching, so the template, colors and fonts
                  are set by your Office admin. If they turn off the design lock, you&apos;ll be able
                  to customize your card&apos;s look right here.
                </p>
              </div>
            ) : (
            <div className="space-y-4 border-t border-gray-800 pt-4">
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
                    className={`text-xs font-semibold py-2 rounded-xl border transition-colors ${
                      template === id ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white"
                    }`}
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
                  <PlanGate
                    feature="colors-fonts"
                    nativeCopy="Pro feature — Custom colors and fonts are only available on the Pro plan."
                  >
                    <Link href="/upgrade" className="block text-center text-[11px] text-blue-400 hover:text-blue-300 mt-2">
                      Unlock custom colors &amp; fonts with Pro →
                    </Link>
                  </PlanGate>
                )}
              </div>
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-500">Website</label>
                    {org && orgWebsite && <ManagedTag />}
                  </div>
                  <input
                    type="text"
                    placeholder="yoursite.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={!!(org && orgWebsite)}
                    className={`${inputCls} ${org && orgWebsite ? "opacity-60 cursor-not-allowed" : ""}`}
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
                    <div key={i} className="flex items-center gap-2.5 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5">
                      <LinkPreviewThumb url={l.url} />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-200 text-xs font-semibold truncate">{l.label}</p>
                        <p className="text-gray-500 text-[10px] truncate">{l.url}</p>
                      </div>
                      <button type="button" onClick={() => removeLink(i)} className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none shrink-0">×</button>
                    </div>
                  ))}
                </div>
              )}
              {atLinkCap ? (
                <PlanGate
                  feature="swift-links-cap"
                  nativeCopy="Pro feature — Free includes 2 links. More links are only available on the Pro plan."
                >
                  <p className="text-[11px] text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 leading-relaxed">
                    Free includes {PLAN_LIMITS.FREE_MAX_LINKS} additional links. <a href="/upgrade" className="text-blue-400 font-semibold hover:text-blue-300">Upgrade to Pro</a> to access unlimited additional links.
                  </p>
                </PlanGate>
              ) : (
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
                    const readyToAdd = !!newLink.label.trim() && !!newLink.url.trim();
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
              )}
            </div>
          </div>
        )}

        {/* ── SOCIAL DESIGN — the Swift Links page's look, with a live preview
            of the page itself. Separate keys from the card design, so the two
            tabs never fight over the same values. ── */}
        {tab === "linkdesign" && (
          <div className="space-y-4">
            <SwiftLinkStyleControls value={linkStyleState} onChange={patchLinkStyle} locked={!isPro} />
            {!isPro && (
              <PlanGate
                feature="colors-fonts"
                nativeCopy="Pro feature — Custom colors and fonts are only available on the Pro plan."
              >
                <Link href="/upgrade" className="block text-center text-[11px] text-blue-400 hover:text-blue-300">
                  Unlock custom colors &amp; fonts with Pro →
                </Link>
              </PlanGate>
            )}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Your Swift Links page — this is how it will look
              </p>
              <SwiftLinkPagePreview
                style={linkStyleState}
                name={name || card.username}
                handle={card.username}
                company={company}
                bio={bio}
                photoUrl={photoState}
                socialKeys={(Object.keys(socials) as SocialKey[]).filter((k) => socials[k].trim())}
                links={links}
              />
            </div>
          </div>
        )}

        {error && (
          viewOnly ? (
            <PlanGate
              feature="card-view-only"
              nativeCopy="This card is view-only. Editing multiple cards is only available on the Pro plan."
            >
              <p className="text-red-400 text-sm mt-4">
                {error} <a href="/upgrade" className="underline font-semibold text-blue-400 hover:text-blue-300">Upgrade to Pro</a>
              </p>
            </PlanGate>
          ) : (
            <p className="text-red-400 text-sm mt-4">{error}</p>
          )
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <DashboardLink card={card.username} className="flex-1 text-center border border-gray-700 text-gray-400 hover:border-gray-500 font-semibold py-3 rounded-full transition-colors text-sm">
            Cancel
          </DashboardLink>
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
          {/* "View live" removed entirely (owner request) — both the header and
              this preview link are gone from the card editor. */}
        </div>
        {/* Look-only: the card's own phone/email/links stay clickable on the
            PUBLISHED card, but never here — design is changed with the controls
            on the left, not by clicking the picture. See InertPreview. */}
        <InertPreview className="rounded-2xl overflow-hidden border border-gray-800">
          {/* Scale from the 460px natural width (same as the published card) so a
              long name/title/company never clips in-preview. */}
          <CardScaler>
            <PreviewTemplate data={customSelected ? previewData : withoutSocials(previewData)} />
          </CardScaler>
        </InertPreview>
        {tab === "sharing" || tab === "linkdesign" ? (
          <p className="text-gray-600 text-[11px] mt-2 leading-snug">Editing your <span className="text-gray-400">Swift Links</span> page — the card above only shows your name, title & contact details.</p>
        ) : (
          <p className="text-gray-600 text-[11px] mt-2 leading-snug">Your changes appear here instantly.</p>
        )}
      </div>
    </div>
  );
}
