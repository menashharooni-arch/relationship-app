"use client";

import { useState } from "react";
import type { SketchSocials, SketchLink } from "./useProductSketch";
import { socialInput, socialHint } from "@/lib/social-input";

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
      <span className="block text-white/55 text-[0.75rem] font-medium mb-1.5">{label}</span>
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
      <span className="block text-white/55 text-[0.75rem] font-medium mb-1.5">{label}</span>
      <textarea className={`${inputCls} resize-none`} rows={3} {...props} />
    </label>
  );
}

// Same wording as the real builder and the card editor, from the one module
// that decides it (lib/social-input): every box asks for just a username, and
// the hint underneath shows the address it becomes. These used to mix a URL on
// some rows with an @handle on others — the confusion the owner reported
// 2026-09-15. The mini-builders keep their own subset and order.
const MINI_SOCIAL_KEYS: (keyof SketchSocials)[] = ["linkedin", "instagram", "tiktok", "twitter", "facebook", "youtube"];
const SOCIALS = MINI_SOCIAL_KEYS.map((k) => socialInput(k)!);

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
  const list = only ? SOCIALS.filter((s) => only.includes(s.key as keyof SketchSocials)) : SOCIALS;
  return (
    <div className="space-y-2.5">
      {list.map((s) => (
        <div key={s.key}>
          <Field
            label={s.label}
            placeholder={s.placeholder}
            value={socials[s.key as keyof SketchSocials]}
            onChange={(e) => onChange(s.key as keyof SketchSocials, e.target.value)}
          />
          <p className="text-white/40 text-[0.625rem] mt-1 leading-snug">{socialHint(s)}</p>
        </div>
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
      <span className="block text-white/55 text-[0.75rem] font-medium mb-1">{label}</span>
      <p className="text-white/70 text-[0.6875rem] mb-2 leading-snug">{hint}</p>

      {links.length > 0 && (
        <div className="space-y-1.5 mb-2.5">
          {links.map((l, i) => (
            <div key={`${l.label}-${i}`} className="flex items-center gap-2 rounded-xl bg-[#15171F] border border-white/10 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-white text-sm truncate">{l.label}</span>
                <span className="block text-white/40 text-[0.6875rem] truncate">{l.url}</span>
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

// The card editor's "Logo shape on the card" control, for the builders. Same
// labels and same copy as the signed-in editor, and like the editor it only
// means anything once a logo exists — the caller renders it conditionally.
export function LogoShapeToggle({
  value,
  onChange,
}: {
  value: "auto" | "circle";
  onChange: (v: "auto" | "circle") => void;
}) {
  return (
    <div className="mt-2.5">
      <span className="block text-white/55 text-[0.75rem] font-medium mb-1.5">Logo shape on the card</span>
      <div className="inline-flex items-center rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.06)" }}>
        {([["auto", "Original"], ["circle", "Circle"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={value === id}
            className="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
            style={{
              background: value === id ? "rgba(255,255,255,0.14)" : "transparent",
              color: value === id ? "#fff" : "rgba(255,255,255,0.55)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-white/40 text-[0.625rem] mt-1 leading-snug">
        {value === "circle"
          ? "Your full logo inside a clean circle — nothing gets cut off."
          : "Adapts to your logo — square, wide, or banner."}
      </p>
    </div>
  );
}
