import type { CSSProperties } from "react";
import { QRCodeSVG } from "qrcode.react";
import { passPalette } from "@/lib/wallet-palette";
import type { ResolvedCardMeta } from "@/lib/resolve-card";
import type { TemplateStyle } from "@/lib/template-style";
import {
  BAND_ASPECT, PAD_LEFT, PAD_RIGHT, IMG, GAP, CONTENT_SCALE,
  NAME_BASE, TITLE_BASE, COMPANY_BASE,
  bandPx, bandVariant, initialsOf, surfaceLayers,
} from "@/lib/wallet-band";

// ── The SwiftCard Apple Wallet pass, drawn in the DOM ───────────────────────
//
// A picture of the REAL pass, not an impression of one. Anywhere the product
// shows someone what they get in Wallet, it shows this — so the promise and
// the download are the same object.
//
// It is faithful because it is derived, not copied. The colours, textures and
// type treatment come from passPalette(), the same function the pass
// generator calls; the band's surface is painted from surfaceLayers(), the
// same layer list Satori paints the real strip from; the band's proportions
// come from lib/wallet-band.ts; and the blocks below are what lib/wallet.ts
// actually puts in the pass:
//
//   1. the strip — the band, composed from the card's own parts
//   2. two secondary fields — PHONE and EMAIL, on the card's details colour
//   3. the barcode — a QR of the card URL, altText "Scan to connect"
//
// What it deliberately does NOT do is show a shrunken picture of the business
// card. That was the old marketing mock, and it promised a pass the product
// has never produced: a 1.75:1 card inside a 3.05:1 strip is 57% of the width
// with grey either side, which is the exact design the real pass was rebuilt
// to stop being.
//
// Type is the one thing that cannot match exactly: Satori renders the strip
// with its own bundled sans and no card font exists server-side, so the real
// band is already a system sans. Case, tracking and weight carry through the
// palette's `voice` and are applied here.

export type WalletPassCard = {
  name: string | null;
  title?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
  template?: string | null;
  /** The card's Pro style overrides (colours, finish), when a caller has them. */
  style?: TemplateStyle;
  cardUrl: string;
};

/** Everything passPalette() reads, defaulted for the fields a caller omits. */
function metaFor(card: WalletPassCard): NonNullable<ResolvedCardMeta> {
  return {
    name: card.name, title: card.title ?? null, company: card.company ?? null,
    photoUrl: card.photoUrl ?? null, logoUrl: card.logoUrl ?? null,
    phone: card.phone ?? null, email: card.email ?? null,
    website: null, address: null,
    accentColor: card.accentColor ?? null,
    template: card.template ?? null,
    // The templates read the accent from the card's style, so that is where
    // the pass reads it too.
    style: { ...(card.accentColor ? { accentColor: card.accentColor } : {}), ...card.style },
    custom: null,
  };
}

// The empty header row. Wallet lays a storeCard out as header → strip →
// fields → barcode, and the header row exists even when it carries nothing —
// SwiftCard's pass deliberately ships no logo and no logoText (wallet.ts), so
// on the real pass that row is a quiet band of backgroundColor above the
// strip. A mock whose strip touches the top edge is showing a pass Apple
// never draws. ~40pt, expressed @3x like every other measurement here.
const HEADER_H = 120;

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export default function WalletPassFace({
  card,
  width = 240,
  height,
  className = "",
}: {
  card: WalletPassCard;
  /** Pass width in px. Everything scales from this — see bandPx. */
  width?: number;
  /** Fixed pass height. Wallet anchors the barcode block to the BOTTOM of the
   *  pass and lets backgroundColor fill the space between the fields and the
   *  barcode — the pass is a fixed-size object, not a shrink-wrapped stack.
   *  With a height, this renders that way (flex column, spacer above the
   *  barcode). Without one it shrink-wraps, for surfaces that need natural
   *  height. */
  height?: number;
  className?: string;
}) {
  const palette = passPalette(metaFor(card));
  const { ink, inkMuted, accent, title: titleInk, voice, rule, nameShadow, lead, body } = palette;
  const variant = bandVariant(palette.prefer, !!card.photoUrl, !!card.logoUrl);
  const px = (at3x: number) => bandPx(width, at3x);
  /** A card design-px measurement drawn with the type (see CONTENT_SCALE). */
  const cp = (design: number) => px(design * CONTENT_SCALE);

  const lead3 = px(IMG);
  const bandH = Math.round(width * BAND_ASPECT);
  // Apple's barcode block: a ~150pt white square in a 375pt pass. The QR
  // inside it is that box minus its quiet zone.
  const qr = Math.round(width * 0.38);

  const field = (label: string, value: string) => (
    <div style={{ minWidth: 0, flex: 1 }}>
      <p style={{
        margin: 0, fontSize: Math.max(6.5, px(26)), fontWeight: 600, color: body.label,
        letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1.2,
      }}>{label}</p>
      {/* The 7.5px floor is what keeps this legible in a small marketing mock:
          proportionally px(30) lands near 5px, which no one can read. The
          floor does mean the value type runs slightly large for the pass at
          mock scale — the tradeoff is deliberate, but it is also why the
          demo email has to be short enough to survive it without ellipsis. */}
      <p style={{
        margin: `${px(6)}px 0 0`, fontSize: Math.max(7.5, px(30)), fontWeight: 500, color: body.value,
        lineHeight: 1.25, ...ellipsis,
      }}>{value}</p>
    </div>
  );

  return (
    <div
      className={className}
      style={{
        width,
        ...(height ? { height, display: "flex", flexDirection: "column" } : {}),
        // The pass colour — the card's details side. It is also what Apple
        // paints the empty header row with, above the strip.
        background: body.background,
        // ~10pt at pass scale. The old 0.055 was nearly twice Apple's radius
        // and read as a widget, not a pass.
        borderRadius: Math.round(width * 0.03),
        overflow: "hidden", boxShadow: "0 12px 28px -10px rgba(15,23,42,0.45)",
      }}
    >
      {/* 0 ── the empty header row Wallet always reserves (see HEADER_H) */}
      <div style={{ height: px(HEADER_H), flex: "none" }} />

      {/* 1 ── the strip: the card's panel, then its identity */}
      <div style={{ position: "relative", height: bandH, flex: "none", overflow: "hidden" }}>
        {surfaceLayers(palette.surface, width, bandH).map((layer, i) =>
          layer.kind === "media" ? (
            // eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative preview
            <img key={i} src={layer.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div key={i} style={layer.style as CSSProperties} />
          ),
        )}

        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          padding: `0 ${px(PAD_RIGHT)}px 0 ${px(PAD_LEFT)}px`, overflow: "hidden",
        }}>
          {variant === "portrait" ? (
            card.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative preview
              <img src={card.photoUrl} alt="" width={lead3} height={lead3}
                style={{ width: lead3, height: lead3, borderRadius: lead3, objectFit: "cover", border: `${px(6)}px solid ${accent}`, flex: "none" }} />
            ) : (
              <div style={{
                width: lead3, height: lead3, borderRadius: lead3, border: `${px(6)}px solid ${accent}`,
                flex: "none", background: "rgba(255,255,255,0.14)", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: px(86), fontWeight: 700, color: ink, letterSpacing: "0.01em",
              }}>{initialsOf(card.name)}</div>
            )
          ) : (
            <div style={{
              width: lead3, height: lead3, borderRadius: px(28), flex: "none",
              background: card.logoUrl ? lead.tile : lead.monogram.background,
              ...(lead.edge ? { border: `${px(3)}px solid ${lead.edge}` } : {}),
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}>
              {card.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative preview
                <img src={card.logoUrl} alt="" style={{ maxWidth: "78%", maxHeight: "78%", objectFit: "contain" }} />
              ) : (
                <span style={{ fontSize: px(88), fontWeight: 700, color: lead.monogram.color, letterSpacing: "0.04em" }}>
                  {initialsOf(card.company || card.name)}
                </span>
              )}
            </div>
          )}

          <div style={{ width: px(GAP), flex: "none" }} />

          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, overflow: "hidden" }}>
            {rule?.at === "above-name" ? (
              <span style={{
                width: cp(rule.width), height: cp(rule.height), borderRadius: cp(rule.height),
                background: rule.color, marginBottom: cp(4),
              }} />
            ) : null}

            <p style={{
              margin: 0, fontSize: px(NAME_BASE), fontWeight: voice.weight, color: ink,
              lineHeight: 1.08, letterSpacing: `${voice.tracking}em`,
              ...(voice.caps ? { textTransform: "uppercase" as const } : {}),
              ...(nameShadow ? { textShadow: `0 ${cp(nameShadow.y)}px ${cp(nameShadow.blur)}px ${nameShadow.color}` } : {}),
              ...ellipsis,
            }}>{card.name || "SwiftCard"}</p>

            {card.title ? (
              <div style={{ display: "flex", alignItems: "center", marginTop: px(14), minWidth: 0 }}>
                {rule?.at === "before-title" ? (
                  <span style={{ width: cp(rule.width), height: Math.max(1, cp(rule.height)), background: rule.color, marginRight: cp(6), flex: "none" }} />
                ) : null}
                <p style={{
                  margin: 0, fontSize: px(TITLE_BASE), color: titleInk, fontWeight: 600,
                  lineHeight: 1.2, letterSpacing: `${voice.titleTracking}em`,
                  ...(voice.titleCaps ? { textTransform: "uppercase" as const } : {}),
                  ...ellipsis,
                }}>{card.title}</p>
              </div>
            ) : null}

            {card.company ? (
              <p style={{
                margin: `${px(6)}px 0 0`, fontSize: px(COMPANY_BASE), color: inkMuted, fontWeight: 600,
                lineHeight: 1.2, letterSpacing: `${voice.companyTracking}em`,
                ...(voice.companyCaps ? { textTransform: "uppercase" as const } : {}),
                ...ellipsis,
              }}>{card.company}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* 2 ── the fields Wallet draws under the strip */}
      {(card.phone || card.email) && (
        <div style={{ display: "flex", gap: px(46), padding: `${px(34)}px ${px(PAD_LEFT)}px ${px(30)}px`, flex: "none" }}>
          {card.phone ? field("Phone", card.phone) : null}
          {card.email ? field("Email", card.email) : null}
        </div>
      )}

      {/* Wallet fills the space between the fields and the barcode with the
          pass colour — the barcode is anchored to the bottom, not stacked
          under the fields. This spacer is that fill (fixed-height mode only). */}
      {height ? <div style={{ flex: 1 }} /> : null}

      {/* 3 ── the barcode block. Apple draws it black on white, whatever the
              pass colour — there is no key to colour it. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: `${px(16)}px 0 ${px(40)}px`, flex: "none" }}>
        <div style={{ background: "#fff", borderRadius: px(18), padding: px(18), lineHeight: 0 }}>
          {/* qrcode.react emits <svg role="img"> with no name, so VoiceOver
              announced a bare "image" (axe: svg-img-alt). `title` renders a
              <title> inside the svg, which is the accessible name. */}
          <QRCodeSVG value={card.cardUrl} size={qr} bgColor="#ffffff" fgColor="#000000" level="M"
            title={`QR code that opens ${card.name || "this"} SwiftCard`} />
        </div>
        <p style={{ margin: `${px(14)}px 0 0`, fontSize: Math.max(7, px(25)), color: body.value, opacity: 0.75, letterSpacing: "0.01em" }}>
          Scan to connect
        </p>
      </div>
    </div>
  );
}
