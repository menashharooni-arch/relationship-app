"use client";

import { useState } from "react";
import { SwiftLinkStyleControls, type SwiftLinkStyle } from "@/components/SwiftLinkDesign";
import SwiftLinkLivePreview from "@/components/SwiftLinkLivePreview";
// From lib/office-link-design, NOT lib/office-brand: that module reaches for
// the service-role database client, and importing a value from it here would
// put it on this client bundle's path.
import { OFFICE_LINK_DESIGN_KEYS } from "@/lib/office-link-design";

// ── Branding → Links ────────────────────────────────────────────────────────
//
// The Swift Links half of the Branding page, and a deliberate mirror of the
// Card half beside it: the same three numbered sections, the same lock
// checkbox at the foot, the same one save button. An admin who has set up
// their cards already knows how this works.
//
// The two halves post SEPARATE keys to /api/office/brand and are saved
// independently, so working on one can never blank the other.
//
// THE TWO RULES, which are the card's rules applied to this surface:
//
//   CONTENT (Instagram, pinned links, bio) behaves like Company information —
//   whatever the admin fills in lands on every member's page and is read-only
//   for them, whether or not the design is locked. A field left blank stays
//   the member's own.
//
//   APPEARANCE behaves like Card appearance — pushed only while "Keep every
//   Swift Links page matching" is ticked.
//
// Pinned links are ADDITIVE. A member can always add their own underneath;
// they simply cannot touch the office's. An office wants its booking link on
// every page, not to stop a salesperson linking their own calendar.

type OfficeRow = {
  // No id: /api/office/brand resolves the office from the SESSION, never from
  // anything the client sends, so this component never needs to know it.
  name?: string | null;
  brand_company?: string | null;
  brand_website?: string | null;
  brand_logo_url?: string | null;
  brand_link_design?: Record<string, unknown> | null;
  brand_link_bio?: string | null;
  brand_link_instagram?: string | null;
  brand_links?: { label: string; url: string }[] | null;
  brand_locks?: { template?: boolean; linkDesign?: boolean } | null;
};

const inputCls =
  "w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40";

function Section({ n, title, desc, children }: { n: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="shrink-0 w-6 h-6 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[0.6875rem] font-bold grid place-items-center">
          {n}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <p className="text-[0.6875rem] text-gray-500 mt-0.5 leading-snug">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function OfficeLinksBranding({ office }: { office: OfficeRow }) {
  // The page's look, read with the same shape the member's own Social design
  // step writes. Only the office vocabulary is kept, so a stray key from an
  // older blob can never reach the controls.
  const [style, setStyle] = useState<SwiftLinkStyle>(() => {
    const d = (office.brand_link_design ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of OFFICE_LINK_DESIGN_KEYS) {
      const v = d[k as string];
      if (v !== undefined && v !== null && v !== "") out[k as string] = v;
    }
    return out as SwiftLinkStyle;
  });
  const patchStyle = (p: Partial<SwiftLinkStyle>) => setStyle((prev) => ({ ...prev, ...p }));

  const [bio, setBio] = useState(office.brand_link_bio ?? "");
  const [instagram, setInstagram] = useState(office.brand_link_instagram ?? "");
  const [links, setLinks] = useState<{ label: string; url: string }[]>(office.brand_links ?? []);
  const [newLink, setNewLink] = useState({ label: "", url: "" });
  // Opt-in: an office that has never opened this tab must not silently start
  // overwriting pages its members already built.
  const [lockLinkDesign, setLockLinkDesign] = useState(office.brand_locks?.linkDesign === true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const readyToAdd = !!newLink.label.trim() && /^https?:\/\//i.test(newLink.url.trim());
  function addLink() {
    if (!readyToAdd) return;
    setLinks((prev) => [...prev, { label: newLink.label.trim(), url: newLink.url.trim() }]);
    setNewLink({ label: "", url: "" });
  }

  async function save() {
    if (status === "saving") return;
    setStatus("saving");
    try {
      const res = await fetch("/api/office/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // ONLY the Links keys. The Card tab's fields are absent, so the route
        // leaves every one of them exactly as it found them.
        body: JSON.stringify({ linkDesign: style, linkBio: bio, linkInstagram: instagram, links, lockLinkDesign }),
      });
      setStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  }

  // What the preview stands in for: a teammate's page under this branding.
  const previewSocials = { instagram: instagram || "yourteam", website: office.brand_website ?? undefined };

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="space-y-4 min-w-0">
        <Section
          n={1}
          title="Links information"
          desc="What every teammate's Swift Links page says. Leave anything blank to let them write their own."
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="office-link-bio" className="block text-xs font-medium text-gray-400 mb-1">Bio</label>
              <textarea
                id="office-link-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="One or two lines about the company — appears under everyone's name."
                className={`${inputCls} resize-none`}
              />
              <p className="text-[0.625rem] text-gray-600 mt-1">
                {bio ? "Everyone's page shows this. Leave it empty to let each person write their own." : "Empty — each teammate writes their own."}
              </p>
            </div>

            <div>
              <label htmlFor="office-link-ig" className="block text-xs font-medium text-gray-400 mb-1">Company Instagram</label>
              <input
                id="office-link-ig"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@yourcompany"
                className={inputCls}
              />
              <p className="text-[0.625rem] text-gray-600 mt-1">
                The only social the office sets. LinkedIn, TikTok, X and the rest stay each teammate&apos;s own.
              </p>
            </div>

            <div>
              <p className="block text-xs font-medium text-gray-400 mb-1">Company link buttons</p>
              <p className="text-[0.625rem] text-gray-600 mb-2.5">
                These appear at the top of every teammate&apos;s page and they can&apos;t change them — but they can
                still add their own underneath.
              </p>
              {links.length > 0 && (
                <div className="space-y-2 mb-2">
                  {links.map((l, i) => (
                    <div key={`${l.url}-${i}`} className="flex items-center gap-2.5 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-200 text-xs font-semibold truncate">{l.label}</p>
                        <p className="text-gray-600 text-[0.625rem] truncate">{l.url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLinks((prev) => prev.filter((_, xi) => xi !== i))}
                        aria-label={`Remove ${l.label}`}
                        className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <input
                  value={newLink.label}
                  onChange={(e) => setNewLink((n) => ({ ...n, label: e.target.value }))}
                  placeholder="Button name (e.g. Book a meeting)"
                  className={inputCls}
                />
                <input
                  value={newLink.url}
                  onChange={(e) => setNewLink((n) => ({ ...n, url: e.target.value }))}
                  placeholder="https://…"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={addLink}
                  disabled={!readyToAdd}
                  className={`w-full text-xs font-semibold py-2.5 rounded-xl transition-colors ${
                    readyToAdd
                      ? "bg-purple-600 hover:bg-purple-500 text-white"
                      : "border border-dashed border-gray-700 text-gray-500"
                  }`}
                >
                  + Add company link
                </button>
              </div>
            </div>
          </div>
        </Section>

        <Section
          n={2}
          title="Links appearance"
          desc="The design your whole team inherits — the same controls your teammates see under Social design."
        >
          <SwiftLinkStyleControls value={style} onChange={patchStyle} />
        </Section>

        <Section n={3} title="What team members can edit" desc="Everything else on their page is what you set above.">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4">
            <div>
              <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">They fill in</p>
              <ul className="space-y-1">
                {[
                  "Their name and photo",
                  "Their own link buttons",
                  ...(bio ? [] : ["Their bio"]),
                  "LinkedIn, TikTok, X, Facebook, YouTube, Snapchat",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-1.5 text-[0.6875rem] text-gray-400">
                    <span className="text-gray-600 shrink-0" aria-hidden="true">✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">You control</p>
              <ul className="space-y-1">
                {[
                  ...(bio ? ["The bio"] : []),
                  ...(instagram ? ["Company Instagram"] : []),
                  ...(links.length ? ["Company link buttons"] : []),
                  ...(lockLinkDesign ? ["The page's whole look"] : []),
                ].map((t) => (
                  <li key={t} className="flex items-start gap-1.5 text-[0.6875rem] text-gray-500">
                    <span className="text-gray-600 shrink-0" aria-hidden="true">🔒</span>{t}
                  </li>
                ))}
                {!bio && !instagram && !links.length && !lockLinkDesign && (
                  <li className="text-[0.6875rem] text-gray-600">Nothing yet — fill anything in above and it lands here.</li>
                )}
              </ul>
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={lockLinkDesign}
              onChange={(e) => setLockLinkDesign(e.target.checked)}
              className="accent-purple-500 mt-0.5"
            />
            <span>
              Keep every Swift Links page matching
              <span className="block text-[0.6875rem] text-gray-600 mt-0.5">
                Your teammates keep their own bio, socials and links — only the look becomes yours.
                Leave it off to let each person design their own page.
              </span>
            </span>
          </label>
        </Section>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={save}
            disabled={status === "saving"}
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : "Save & apply to all Swift Links"}
          </button>
          {status === "saved" && <span className="text-green-400 text-xs font-semibold">Applied to every page ✓</span>}
          {status === "error" && <span className="text-red-400 text-xs font-semibold">Couldn&apos;t save — try again</span>}
        </div>
      </div>

      <aside className="lg:sticky lg:top-4">
        <p className="text-[0.6875rem] font-semibold text-gray-400 uppercase tracking-wide mb-2">Live preview</p>
        <div className="rounded-2xl overflow-hidden border border-gray-800">
          <SwiftLinkLivePreview
            name="Sam Rivera"
            handle="samrivera"
            company={office.brand_company ?? undefined}
            title="Associate"
            bio={bio || "Their own bio goes here."}
            logoUrl={office.brand_logo_url ?? undefined}
            socials={previewSocials}
            links={links}
            style={style}
            paid
          />
        </div>
        <p className="text-[0.6875rem] text-gray-600 mt-2.5 leading-snug">
          A teammate&apos;s page under this branding. Their name, photo and their own links are theirs.
        </p>
      </aside>
    </div>
  );
}
