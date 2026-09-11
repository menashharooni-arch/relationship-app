// THE section eyebrow for the marketing site (design batch 3, 2026-09-11).
//
// Every section on every marketing page opens with this pill: a dot in the
// brand aurora, then a short label. It used to be two things — this pill on
// the homepage, and a bare uppercase kicker (`.rd-eyebrow`) on the product,
// compare, blog and legal pages — so the pages did not read as one site.
// `.rd-eyebrow` is still the right class for LABELS (footer column titles,
// nav group titles, a reviewer's role); it is no longer used for eyebrows.
//
// `dark` is the section it sits on, not the pill's own colour: dark sections
// get the translucent pill, light sections the white one with a hairline.
export default function Eyebrow({ children, dark = true, className = "" }: { children: React.ReactNode; dark?: boolean; className?: string }) {
  return (
    <span className={`rd-pill ${dark ? "rd-pill-d" : "rd-pill-l"} ${className}`.trim()}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--rd-aurora)" }} aria-hidden="true" />
      {children}
    </span>
  );
}
