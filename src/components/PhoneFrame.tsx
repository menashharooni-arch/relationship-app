import type { CSSProperties, ReactNode } from "react";

// ── One iPhone, for the whole marketing site ─────────────────────────────────
//
// There were six phone shells in this codebase and no two agreed: the hero's
// was a flat navy rectangle with no Dynamic Island at all, TemplateGallery and
// LeadCapturePhone had copy-pasted status bars, ShareWaysPhones drew its own in
// CSS, and two more sat unused. A visitor scrolling the homepage passed three
// different "iPhones" in one page. This is the only one now.
//
// WHY IT LOOKS LIKE A PHONE AND NOT A DRAWING OF ONE
//
// A flat dark rounded rectangle reads as a toy no matter how good the screen
// content is, because four things your eye checks are missing. In rough order
// of how much each one buys:
//
//  1. The Dynamic Island. The single most recognisable feature of a modern
//     iPhone. Without it the brain files the object under "generic phone".
//  2. The rail. A real phone's edge is titanium: bright where the light hits
//     it, dark where it curves away, with a hairline catching the very top
//     edge. One flat colour is what makes a mockup look like plastic.
//  3. Two shadows, not one. Objects cast a tight dark shadow where they touch
//     and a wide soft one further out. A single blur is the sticker look.
//  4. A reflection. Glass returns some of the room. Without it the screen
//     reads as printed paper behind a frame.
//
// PROPORTIONS ARE MEASURED, NOT PICKED
//
// Every dimension is a fraction of the rendered width, taken from a real
// iPhone 15 Pro, so the frame is correct at 240px and at 340px:
//
//   body 70.6mm x 146.6mm            -> aspect 1 : 2.077
//   screen 393 x 852pt, 55pt corner  -> screen radius 14.0% of screen width
//   bezel 2.2mm of a 70.6mm body     -> 3.1% of body width per side
//   Dynamic Island 125 x 37pt        -> 31.8% x 9.4% of screen width
//   home indicator 139 x 5pt         -> 35.4% x 1.3% of screen width
//
// The old hero used a 38px radius on a 280px phone. The real number is 43.
// That 5px is most of why it read as a cartoon.

type Tone = "dark" | "light";

/**
 * The width of the SCREEN inside a frame of this body width.
 *
 * Exported because the status bar has to be spaced around the Dynamic Island,
 * and the Island's size is a fraction of the screen — not of the body. When
 * three components each hand-rolled a status bar with a guessed padding, the
 * 240px phone's icons ended up UNDER the Island: its old hand-set 48px notch
 * had been narrower than a real one, and correcting the Island's proportion
 * exposed the guess. Anything drawing into the screen should measure it.
 */
export function phoneScreenWidth(width: number): number {
  const rail = Math.max(2, width * 0.0115);
  const bezel = Math.max(5, width * 0.0195);
  return width - (rail + bezel) * 2;
}

export function StatusBar({
  width,
  tone = "dark",
  className = "",
}: {
  /** Screen width in px — glyphs and the gap around the Island scale off it. */
  width: number;
  /** `dark` = dark glyphs for a light screen. */
  tone?: Tone;
  className?: string;
}) {
  const color = tone === "dark" ? "#0F172A" : "#FFFFFF";
  // The time and the icons sit either side of the Island, vertically centred
  // on it — that is what makes the Island read as part of the hardware rather
  // than a black blob floating on the page.
  const islandH = width * 0.094;
  const islandTop = width * 0.028;
  const fs = Math.max(9, Math.round(width * 0.042));
  return (
    <div
      aria-hidden="true"
      className={`relative z-[25] flex items-center justify-between shrink-0 ${className}`}
      style={{
        height: islandTop + islandH,
        paddingTop: islandTop * 0.55,
        paddingLeft: width * 0.085,
        paddingRight: width * 0.075,
        color,
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      <span style={{ lineHeight: 1 }}>9:41</span>
      <span className="flex items-center" style={{ gap: fs * 0.34 }}>
        {/* Cellular — four bars, the last one dimmed, exactly as iOS draws it */}
        <svg viewBox="0 0 18 12" style={{ width: fs * 1.18, height: fs * 0.79 }} fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" opacity="0.35" />
        </svg>
        {/* Wi-Fi */}
        <svg viewBox="0 0 20 14" style={{ width: fs * 1.16, height: fs * 0.81 }} fill="currentColor">
          <path d="M10 3c2.5 0 4.8 1 6.5 2.6l1.4-1.5A11.5 11.5 0 0010 1 11.5 11.5 0 002.1 4.1l1.4 1.5A9.4 9.4 0 0110 3z" />
          <path d="M10 7c1.4 0 2.7.5 3.7 1.4l1.4-1.5A7.4 7.4 0 0010 5a7.4 7.4 0 00-5.1 1.9l1.4 1.5A5.4 5.4 0 0110 7z" />
          <circle cx="10" cy="11.5" r="1.6" />
        </svg>
        {/* Battery — outline, fill, and the little cap */}
        <svg viewBox="0 0 26 13" style={{ width: fs * 1.55, height: fs * 0.78 }} fill="none">
          <rect x="0.5" y="0.5" width="22" height="12" rx="3.6" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="17" height="9" rx="2.2" fill="currentColor" />
          <path d="M24.2 4.6v3.8a2.1 2.1 0 000-3.8z" fill="currentColor" opacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

export default function PhoneFrame({
  children,
  width = 320,
  screenStyle,
  className = "",
  style,
  ariaLabel,
  /**
   * Built-in status bar.
   *   true      — in the normal flow, so screen content starts beneath it.
   *   "overlay" — floated on top, for a screen whose content is absolutely
   *               positioned or starts with a full-bleed image. This is what a
   *               real phone does: the OS draws the status bar over the app.
   *   false     — the screen content supplies its own (import StatusBar).
   */
  statusBar = true,
  statusTone = "dark",
  /** Degrees. A couple of degrees is the difference between a photograph and a diagram. */
  tilt = 0,
  /** Home indicator colour follows the screen: light content wants a dark bar. */
  indicatorTone = "dark",
  /** Drop the glass reflection where content must stay perfectly legible. */
  glare = true,
}: {
  children: ReactNode;
  width?: number;
  screenStyle?: CSSProperties;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  statusBar?: boolean | "overlay";
  statusTone?: Tone;
  tilt?: number;
  indicatorTone?: Tone;
  glare?: boolean;
}) {
  // ── Geometry, all derived from the body width ──────────────────────────────
  const rail = Math.max(2, width * 0.0115); // the titanium band
  const bezel = Math.max(5, width * 0.0195); // the black surround inside it
  const bodyRadius = width * 0.155;
  const screenW = phoneScreenWidth(width);
  const screenRadius = bodyRadius - rail - bezel;

  const islandW = screenW * 0.318;
  const islandH = screenW * 0.094;
  const islandTop = screenW * 0.028;

  const indicatorW = screenW * 0.354;
  const indicatorH = Math.max(3, screenW * 0.013);
  const indicatorBottom = screenW * 0.022;

  // Buttons: action + volume pair on the left, power on the right, at the real
  // heights and offsets. They read as machined, not drawn, because they carry
  // the same vertical light as the rail does.
  const btnW = Math.max(2, rail * 0.85);
  const btnFace = "linear-gradient(180deg, #6C7382 0%, #2A3040 45%, #171B26 100%)";

  return (
    <div
      className={`relative ${className}`}
      style={{
        width,
        maxWidth: "100%",
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        ...style,
      }}
      role="group"
      aria-label={ariaLabel}
    >
      {/* THE RAIL.
          Three things happen here at once and all three are needed:
          • the background gradient turns the band from a flat colour into a
            brushed metal edge — light along the top-left, dark as it curves;
          • the inset white hairline is the specular line down the very top
            edge, which is what actually says "metal";
          • two shadows, not one: a tight contact shadow the object sits in,
            and a wide ambient one it casts across the section. */}
      <div
        className="relative"
        style={{
          borderRadius: bodyRadius,
          padding: rail,
          background:
            "linear-gradient(148deg, #9AA3B2 0%, #5B6474 14%, #262C3A 42%, #1A1F2B 62%, #444C5C 88%, #8A93A4 100%)",
          boxShadow: [
            "0 2px 6px -1px rgba(8,10,18,0.45)",
            "0 18px 32px -14px rgba(8,10,18,0.55)",
            "0 54px 90px -34px rgba(8,10,18,0.62)",
            "inset 0 1px 0 0 rgba(255,255,255,0.55)",
            "inset 0 -1px 0 0 rgba(255,255,255,0.18)",
          ].join(", "),
        }}
      >
        {/* Side buttons, behind the body so only their outer edge shows. */}
        <span
          aria-hidden="true"
          className="absolute rounded-l-[2px]"
          style={{ left: -btnW, top: width * 0.2, width: btnW, height: width * 0.075, background: btnFace }}
        />
        <span
          aria-hidden="true"
          className="absolute rounded-l-[2px]"
          style={{ left: -btnW, top: width * 0.305, width: btnW, height: width * 0.115, background: btnFace }}
        />
        <span
          aria-hidden="true"
          className="absolute rounded-l-[2px]"
          style={{ left: -btnW, top: width * 0.44, width: btnW, height: width * 0.115, background: btnFace }}
        />
        <span
          aria-hidden="true"
          className="absolute rounded-r-[2px]"
          style={{ right: -btnW, top: width * 0.345, width: btnW, height: width * 0.185, background: btnFace }}
        />

        {/* THE BEZEL — near-black, and genuinely black rather than navy. A navy
            bezel is the tell that a phone was drawn with a slate palette. */}
        <div
          className="relative"
          style={{
            borderRadius: bodyRadius - rail,
            padding: bezel,
            background: "#050609",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          {/* THE SCREEN */}
          <div
            className="relative overflow-hidden"
            // The screen's own background is what shows THROUGH the status bar
            // row, so it has to be the content's background, not a placeholder.
            // Defaulting it dark put dark status glyphs on a dark strip and the
            // time vanished. Callers override this via `screenStyle`.
            style={{ borderRadius: screenRadius, background: "#FFFFFF", ...screenStyle }}
          >
            {statusBar === true && <StatusBar width={screenW} tone={statusTone} />}
            {children}
            {statusBar === "overlay" && (
              <div className="absolute top-0 inset-x-0 z-[29]">
                {/* A soft scrim so the glyphs hold up over whatever the page
                    puts at the top — a photo's brightness is not ours to
                    predict. It is short and weak enough to read as the phone's
                    own vignette rather than as a band across the design. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 pointer-events-none"
                  style={{
                    height: (islandTop + islandH) * 1.7,
                    background:
                      statusTone === "light"
                        ? "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0) 100%)"
                        : "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)",
                  }}
                />
                <StatusBar width={screenW} tone={statusTone} className="relative" />
              </div>
            )}

            {/* Dynamic Island — true black, above everything on the screen. */}
            <span
              aria-hidden="true"
              className="absolute left-1/2 rounded-full"
              style={{
                top: islandTop,
                width: islandW,
                height: islandH,
                marginLeft: -islandW / 2,
                background: "#000",
                zIndex: 30,
              }}
            />

            {/* Home indicator */}
            <span
              aria-hidden="true"
              className="absolute left-1/2 rounded-full"
              style={{
                bottom: indicatorBottom,
                width: indicatorW,
                height: indicatorH,
                marginLeft: -indicatorW / 2,
                background: indicatorTone === "dark" ? "rgba(15,23,42,0.32)" : "rgba(255,255,255,0.55)",
                zIndex: 30,
              }}
            />

            {/* THE GLASS.
                One soft wash across the top-left, and one narrow bright streak
                with a hard-ish edge. The wash alone reads as a gradient; it is
                the streak that reads as a reflection. Both are inert. */}
            {glare && (
              <span
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  zIndex: 28,
                  // Kept to the top-left corner and kept faint. A reflection
                  // that reaches the middle of the screen stops reading as
                  // glass and starts reading as a mark on the content — which
                  // is exactly what a stronger version of this did over a
                  // card's photo.
                  background:
                    "linear-gradient(140deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 16%, rgba(255,255,255,0) 32%), " +
                    "linear-gradient(122deg, rgba(255,255,255,0) 16%, rgba(255,255,255,0.055) 21%, rgba(255,255,255,0) 26%)",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
