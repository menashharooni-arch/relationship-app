import "@/app/home.css";

// THE section eyebrow for the marketing site.
//
// Redesign 2026-09-17 (owner: "less vibe-coded"): the pill with an aurora dot
// is gone — it was the most template-looking thing on every page. It is now
// the homepage's kicker: short, uppercase, letter-spaced, in the brand
// gradient (.hp-kicker in app/home.css). One eyebrow style across the site.
//
// `dark` is the section it sits on: dark sections get the lighter gradient so
// it stays readable.
export default function Eyebrow({ children, dark = true, className = "" }: { children: React.ReactNode; dark?: boolean; className?: string }) {
  return <span className={`hp-kicker ${dark ? "hp-kicker-d" : ""} ${className}`.trim()}>{children}</span>;
}
