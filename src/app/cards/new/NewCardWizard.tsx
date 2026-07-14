"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import DashboardLink from "@/components/DashboardLink";
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
import CustomDesignCard from "@/components/CustomDesignCard";
import TemplateStyleControls from "@/components/card-templates/TemplateStyleControls";
import AddressInput, { EMPTY_ADDRESS } from "@/components/AddressInput";
import { withoutSocials } from "@/components/card-templates/types";
import type { TemplateStyle } from "@/components/card-templates/shared";
import type { CardAddress, CardData, CardLink, CardPhone, PhoneLabel, CustomLayout } from "@/components/card-templates/types";
import { socialUrl } from "@/lib/social-url";
import { useGuestDraft, saveDraft } from "@/lib/guest-draft";
import { consumePrefill, hasSketchContent, type CardPrefill } from "@/lib/prefill";
// Shared with the edit form + server so a social typed here connects to the
// same URL everywhere (blur, save, guest-draft snapshot all normalize).
import { normalizeSocial } from "@/lib/social-url";
import { writePlanIntent } from "@/lib/plan-intent";
import { PLAN_LIMITS } from "@/lib/plan";
import PlanCards from "@/components/PlanCards";
import GuestGateModal from "@/components/GuestGateModal";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
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
  // After a paid checkout the success page routes the OWNER here to create their
  // card first (it counts as Office seat 1). postcheckout=office → send them on
  // to the Office admin dashboard when done; pro/absent → dashboard.
  const searchParams = useSearchParams();
  const postCheckout = searchParams.get("postcheckout");
  const doneHref = postCheckout === "office" ? "/office" : "/dashboard";
  // A plan-specific CTA (Get Pro / Get Office) routes here with ?plan=… so the
  // visitor still builds their card first, but AFTER account creation goes
  // straight to payment for that plan — no plan chooser again (unified flow).
  const planParam = searchParams.get("plan");
  const presetPlan: "pro" | "office" | null = planParam === "pro" ? "pro" : planParam === "office" ? "office" : null;
  const presetAnnual = searchParams.get("interval") === "annual";
  const presetSeats = Math.max(2, Math.floor(Number(searchParams.get("seats")) || 2));
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

  // The card starts EMPTY. If the visitor sketched a card / SwiftLink /
  // signature on the marketing site, we stash it here and offer a one-tap
  // "Autofill" — nothing is filled in until they explicitly choose it.
  const [pendingPrefill, setPendingPrefill] = useState<CardPrefill | null>(null);
  useEffect(() => {
    const p = consumePrefill();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a localStorage handoff after mount
    if (p && hasSketchContent(p)) setPendingPrefill(p);
  }, []);

  // Apply the stashed sketch into the form — only ever called from the explicit
  // "Autofill" action. Leaves the current step where it is.
  function applyPrefill() {
    const p = pendingPrefill;
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
    setPendingPrefill(null);
  }

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  // Guest flow: after building the card, pick a plan BEFORE creating the account.
  // The choice is stashed (plan-intent) and honored on /welcome after signup —
  // Free → dashboard, Pro/Office → checkout. Authed users skip this (they already
  // have an account/plan) and create the card directly.
  const [showPlan, setShowPlan] = useState(false);

  function pickPlanThenSignUp(intent: Parameters<typeof writePlanIntent>[0]) {
    writePlanIntent(intent);
    // forceGate: always make the visitor pick an account (log in, or sign up with
    // a different email → a NEW account). Never silently save into a session that
    // just happens to be in this browser.
    requireAuth("save", handleCreate, { forceGate: true });
  }

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

  // Free is limited to FREE_MAX_LINKS Swift Links; Pro/Office get unlimited.
  const atLinkCap = !isPro && links.length >= PLAN_LIMITS.FREE_MAX_LINKS;
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
        linkedin: normalizeSocial(socials.linkedin, "linkedin"),
        instagram: normalizeSocial(socials.instagram, "instagram"),
        tiktok: normalizeSocial(socials.tiktok, "tiktok"),
        twitter: normalizeSocial(socials.twitter, "twitter"),
        template,
        logo_url: null,
        customization: {
          bio,
          facebook: normalizeSocial(socials.facebook, "facebook"),
          snapchat: normalizeSocial(socials.snapchat, "snapchat"),
          youtube: normalizeSocial(socials.youtube, "youtube"),
          links, address, phones: cleanPhones, fax: fax.trim(),
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
          // Normalize at save too — onBlur alone misses Enter-to-submit and the
          // prefill autofill path, which set state without ever blurring the field.
          linkedin: normalizeSocial(socials.linkedin, "linkedin"),
          instagram: normalizeSocial(socials.instagram, "instagram"),
          tiktok: normalizeSocial(socials.tiktok, "tiktok"),
          twitter: normalizeSocial(socials.twitter, "twitter"),
          template,
          logo_url: logoUrl,
          customization: {
            bio: bio.trim(),
            facebook: normalizeSocial(socials.facebook, "facebook"),
            snapchat: normalizeSocial(socials.snapchat, "snapchat"),
            youtube: normalizeSocial(socials.youtube, "youtube"),
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

    // A logged-in buyer who built this card as part of Get Pro / Get Office still
    // has to pay — take them straight to checkout for that plan (this new card is
    // seat 1 for Office). `postCheckout` means they already paid and are building
    // the card AFTER payment, so that path skips this and shows the done screen.
    if (!guest && presetPlan && !postCheckout) {
      const qs = new URLSearchParams({ plan: presetPlan, interval: presetAnnual ? "annual" : "monthly" });
      if (presetPlan === "office") qs.set("seats", String(presetSeats));
      router.push(`/checkout?${qs.toString()}`);
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
      <div className={step === 4 ? "max-w-md mx-auto" : "max-w-4xl mx-auto"}>
        {/* Back-link matches how the user got here:
            • guest / marketing entry → "Home" (no jump into a lingering session's
              account without a fresh sign-in);
            • signed-in "Add Card" from the dashboard (add=1 → guest=false, the
              server verified the session) → "Dashboard", back to their cards. */}
        {guest ? (
          <Link href="/" className="text-gray-500 hover:text-white text-sm transition-colors flex items-center gap-1.5 mb-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Home
          </Link>
        ) : (
          <DashboardLink className="text-gray-500 hover:text-white text-sm transition-colors flex items-center gap-1.5 mb-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Dashboard
          </DashboardLink>
        )}

        {/* Steps 1–3: form on the left, a live card preview pinned alongside
            (right on desktop, top on mobile). Step 4 (success) is full-width. */}
        <div className={step === 4 ? "" : "grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:items-start"}>
        <div className={step === 4 ? "" : "min-w-0 order-2 lg:order-1"}>

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

            {/* Explicit autofill — the form stays empty unless the visitor
                chooses to pull in what they sketched on the homepage. */}
            {pendingPrefill && (
              <div className="rounded-xl border border-blue-700/50 bg-blue-950/40 px-4 py-3.5">
                <p className="text-blue-100 text-sm font-semibold">Use what you already entered?</p>
                <p className="text-blue-300/80 text-xs mt-1 leading-relaxed">
                  We saved the details you sketched on the homepage. Autofill them, or start with a blank card.
                </p>
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={applyPrefill} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-full transition-colors">
                    Autofill my details
                  </button>
                  <button type="button" onClick={() => setPendingPrefill(null)} className="px-4 text-gray-400 hover:text-white text-xs font-medium transition-colors">
                    Start blank
                  </button>
                </div>
              </div>
            )}

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
              {atLinkCap ? (
                <p className="text-[11px] text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 leading-relaxed">
                  Free includes {PLAN_LIMITS.FREE_MAX_LINKS} Swift Link. <a href="/pricing" className="text-blue-400 font-semibold hover:text-blue-300 underline">Upgrade to Pro</a> for unlimited links.
                </p>
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
              <h1 className="text-2xl font-bold text-white">Your card is live!</h1>
              <p className="text-blue-400 text-sm mt-1 font-mono">swiftcard.me/card/{username}</p>
            </div>

            <div className="rounded-2xl border border-blue-800/40 bg-blue-950/30 px-4 py-4 text-center">
              <p className="text-blue-200 font-semibold text-sm">Press here to turn on notifications</p>
              <p className="text-blue-300/80 text-xs mt-1.5 leading-relaxed">
                Get an instant alert the moment someone shares their info through your card.
              </p>
            </div>

            <EnablePushButton />

            {postCheckout === "office" ? (
              <button
                type="button"
                onClick={() => router.push("/office")}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 rounded-full transition-colors"
              >
                Go to your Office dashboard →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push(doneHref)}
                className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
              >
                Continue to dashboard →
              </button>
            )}
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

              {/* Custom designer is the editing surface for the custom template;
                  the standard card preview lives in the pinned preview column. */}
              {customSelected && isPro && (
                <div className="mb-3">
                  <CustomCardDesigner layout={customLayout} data={previewData} onChange={setCustomLayout} />
                </div>
              )}

              {/* Custom design — the freeform "edit every element" path */}
              <div className="mb-2">
                <CustomDesignCard isPro={isPro} selected={customSelected} onSelect={() => setTemplate("custom")} />
              </div>

              {/* Standard templates */}
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTemplate(id)}
                    className={`text-xs font-semibold py-2 rounded-xl border transition-colors ${
                      template === id ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white"
                    }`}
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
                  <TemplateStyleControls value={templateStyleState} onChange={patchTemplateStyle} template={template} locked={!isPro} />
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
                onClick={() => {
                  if (!guest) { requireAuth("save", handleCreate); return; }
                  // Plan-specific entry → skip the chooser, carry the plan to payment.
                  if (presetPlan) {
                    pickPlanThenSignUp({ plan: presetPlan, annual: presetAnnual, seats: presetPlan === "office" ? presetSeats : 1 });
                    return;
                  }
                  setShowPlan(true);
                }}
                disabled={status === "loading"}
                className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
              >
                {status === "loading" ? "Creating…"
                  : (presetPlan && !postCheckout) ? `Continue to ${presetPlan === "office" ? "Office" : "Pro"} →`
                  : !guest ? "Create card →"
                  : "Continue to plans →"}
              </button>
            </div>
          </div>
        )}
        </div>{/* editor column */}

        {/* Live preview — pinned alongside on desktop, above the form on mobile */}
        {step !== 4 && (
          <div className="order-1 lg:order-2 lg:sticky lg:top-6">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Live preview</p>
            <div className="rounded-2xl overflow-hidden border border-gray-800">
              <CardScaler>
                <PreviewTemplate data={customSelected ? previewData : withoutSocials(previewData)} />
              </CardScaler>
            </div>
            <p className="text-gray-600 text-[11px] mt-2 leading-snug">Your card so far — it updates as you fill things in.</p>
          </div>
        )}
        </div>{/* grid */}
      </div>
    </main>
    {/* Guest plan step — after the card is built, pick a plan, THEN create the
        account. The choice is stashed and finalized on /welcome post-signup. */}
    {showPlan && guest && (
      <div className="fixed inset-0 z-[90] overflow-y-auto bg-gray-950/97 backdrop-blur-sm">
        <div className="min-h-full flex items-start justify-center py-10 px-5">
          <div className="w-full max-w-6xl">
            <div className="text-center mb-6">
              <button onClick={() => setShowPlan(false)} className="text-gray-500 hover:text-white text-sm mb-4 inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Back to your card
              </button>
              <h2 className="text-white font-bold text-2xl">Choose your plan</h2>
              <p className="text-gray-400 text-sm mt-1.5">Pick a plan, then create your free account. Free to start — upgrade anytime.</p>
            </div>
            <PlanCards
              onFree={() => pickPlanThenSignUp({ plan: "free" })}
              onPaid={(plan, annual, seats) => pickPlanThenSignUp({ plan, annual, seats })}
              busy={null}
              freeLabel="Start free →"
            />
          </div>
        </div>
      </div>
    )}
    {/* Self-contained auth gate — the useGuestDraft hook opens it via a window
        event when a guest triggers a protected action. */}
    <GuestGateModal />
    </>
  );
}
