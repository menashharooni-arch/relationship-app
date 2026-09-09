import type { ReactNode } from "react";

// ── The FAQ disclosure list used by the cream pages ─────────────────────────
//
// /compare/<slug>, /link-in-bio-with-analytics and /business-card-view-tracking
// each carried a byte-identical copy of this markup. Same component, three
// places to change it — which is how the "+" affordance, the row padding and
// the answer's text size were free to drift apart. One copy now.
//
// The heading is part of the block on purpose: all three call sites paired it
// with the same centred "Common questions" h2, so keeping them together is what
// stops the pairing from drifting next time.
//
// The list an FAQPage JSON-LD node is generated from is the SAME array the
// caller passes here — the copy on screen is the structured data, no drift.

export type FaqItem = { q: string; a: string };

export default function FaqAccordion({
  items,
  heading = "Common questions",
  children,
}: {
  items: FaqItem[];
  heading?: string;
  /** Optional CTA rendered under the list, centred. */
  children?: ReactNode;
}) {
  return (
    <section className="max-w-2xl mx-auto w-full px-6 pb-14">
      <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">{heading}</h2>
      <div className="flex flex-col gap-3">
        {items.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-warm-border bg-white px-6 py-5 shadow-sm">
            {/* The summary was only as tall as its own text (23px), so the row's
                generous padding LOOKED clickable and wasn't, and the target sat
                under the 24×24 floor in WCAG 2.5.8. The negative margins cancel
                the matching padding exactly, so nothing moves — the hit area
                just grows to the whole row. */}
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 -mx-6 -my-5 px-6 py-5">
              <span className="text-slate-900 font-semibold text-[0.9375rem]">{f.q}</span>
              {/* Decorative: the open/closed state is already announced by the
                  <details> element itself, so a screen reader should not also
                  read out a stray "+". */}
              <span aria-hidden="true" className="text-slate-500 text-xl leading-none transition-transform group-open:rotate-45 shrink-0">+</span>
            </summary>
            <p className="text-slate-500 text-[0.875rem] mt-3 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
      {children && <div className="mt-10 text-center">{children}</div>}
    </section>
  );
}
