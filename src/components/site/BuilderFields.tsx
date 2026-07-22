"use client";

import { useState } from "react";
import type { SketchSocials, SketchLink } from "./useProductSketch";

// Small form primitives shared by the three homepage product builders, styled
// to match the dark builder shell. Kept in one place so the card, SwiftLink and
// signature flows stay visually identical and a change lands everywhere.

export const inputCls =
  "w-full bg-[#15171F] border border-white/10 text-white placeholder-white/30 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors";

export function Field({
  label,
  prefix,
  ...props
}: { label: string; prefix?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
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

export function TextArea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="block text-white/55 text-[12px] font-medium mb-1.5">{label}</span>
      <textarea className={`${inputCls} resize-none`} rows={3} {...props} />
    </label>
  );
}

const SOCIALS: { key: keyof SketchSocials; label: string; prefix?: string; placeholder: string }[] = [
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/you" },
  { key: "instagram", label: "Instagram", prefix: "@", placeholder: "yourhandle" },
  { key: "tiktok", label: "TikTok", prefix: "@", placeholder: "yourhandle" },
  { key: "twitter", label: "X (Twitter)", prefix: "@", placeholder: "yourhandle" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/you" },
  { key: "youtube", label: "YouTube", placeholder: "youtube.com/@you" },
];

export function SocialFields({
  socials,
  onChange,
  only,
}: {
  socials: SketchSocials;
  onChange: (k: keyof SketchSocials, v: string) => void;
  /** Restrict to a product's supported set (e.g. a signature shows fewer). */
  only?: (keyof SketchSocials)[];
}) {
  const list = only ? SOCIALS.filter((s) => only.includes(s.key)) : SOCIALS;
  return (
    <div className="space-y-2.5">
      {list.map((s) => (
        <Field
          key={s.key}
          label={s.label}
          prefix={s.prefix}
          placeholder={s.placeholder}
          value={socials[s.key]}
          onChange={(e) => onChange(s.key, s.prefix === "@" ? e.target.value.replace(/^@/, "") : e.target.value)}
        />
      ))}
    </div>
  );
}

// Add/remove the custom action buttons that sit under the contact details.
export function LinkButtons({
  links,
  onChange,
  label = "Link buttons",
  hint = "Book a call, menu, portfolio — anything you want one tap away.",
}: {
  links: SketchLink[];
  onChange: (links: SketchLink[]) => void;
  label?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState<SketchLink>({ label: "", url: "" });

  function add() {
    const l = draft.label.trim();
    const u = draft.url.trim();
    if (!l || !u) return;
    onChange([...links, { label: l, url: u }]);
    setDraft({ label: "", url: "" });
  }

  return (
    <div>
      <span className="block text-white/55 text-[12px] font-medium mb-1">{label}</span>
      <p className="text-white/35 text-[11px] mb-2 leading-snug">{hint}</p>

      {links.length > 0 && (
        <div className="space-y-1.5 mb-2.5">
          {links.map((l, i) => (
            <div key={`${l.label}-${i}`} className="flex items-center gap-2 rounded-xl bg-[#15171F] border border-white/10 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-white text-sm truncate">{l.label}</span>
                <span className="block text-white/40 text-[11px] truncate">{l.url}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(links.filter((_, j) => j !== i))}
                aria-label={`Remove ${l.label}`}
                className="shrink-0 text-white/40 hover:text-red-400 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Same add flow as the real builder (/cards/new "Additional links"):
          name field, then URL, then a full-width "+ Add link" that lights up
          once both are filled — so what visitors learn here is exactly what
          they'll do in the wizard. */}
      <div className="space-y-2">
        <input
          className={inputCls}
          placeholder="Link name (e.g. Leave a review)"
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        />
        <input
          className={inputCls}
          placeholder="https://…"
          value={draft.url}
          onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        {(() => {
          const readyToAdd = !!draft.label.trim() && !!draft.url.trim();
          return (
            <button
              type="button"
              onClick={add}
              disabled={!readyToAdd}
              className={`w-full text-xs font-semibold py-2.5 rounded-xl transition-colors ${
                readyToAdd
                  ? "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500"
                  : "border border-dashed border-white/15 text-white/40 disabled:opacity-60"
              }`}
            >
              + Add link
            </button>
          );
        })()}
      </div>
    </div>
  );
}
