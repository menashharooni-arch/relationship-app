import type { CSSProperties, ReactNode } from "react";

// Reusable iPhone-style shell used by the interactive landing-page previews.
// Purely presentational — the caller supplies the screen content and controls
// its own scrolling. `screenStyle` sets the screen height; content that
// overflows should live in its own scroll container (with overscroll-contain)
// so scrolling stays inside the phone.
export default function PhoneFrame({
  children,
  width = 320,
  screenStyle,
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  width?: number;
  screenStyle?: CSSProperties;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{ width, maxWidth: "100%" }}
      role="group"
      aria-label={ariaLabel}
    >
      <div
        className="relative rounded-[2.9rem]"
        style={{
          background: "#0f172a",
          padding: "11px",
          border: "2px solid #1e293b",
          boxShadow: "0 40px 80px -28px rgba(15,23,42,0.55), 0 8px 24px -10px rgba(29,78,216,0.25)",
        }}
      >
        {/* Dynamic island */}
        <div className="absolute top-[13px] left-1/2 -translate-x-1/2 rounded-full z-20" style={{ width: "78px", height: "21px", background: "#0f172a" }} aria-hidden />
        {/* Side buttons */}
        <div className="absolute -right-[3px] top-28 w-[3px] h-10 rounded-r-full" style={{ background: "#1e293b" }} aria-hidden />
        <div className="absolute -left-[3px] top-20 w-[3px] h-7 rounded-l-full" style={{ background: "#1e293b" }} aria-hidden />
        <div className="absolute -left-[3px] top-32 w-[3px] h-7 rounded-l-full" style={{ background: "#1e293b" }} aria-hidden />

        {/* Screen */}
        <div className="relative overflow-hidden" style={{ borderRadius: "2.35rem", background: "#0b1220", ...screenStyle }}>
          {children}
        </div>
      </div>
    </div>
  );
}
