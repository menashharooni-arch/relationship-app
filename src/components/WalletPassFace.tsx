import { QRCodeSVG } from "qrcode.react";
import { passPalette } from "@/lib/wallet-palette";
import type { ResolvedCardMeta } from "@/lib/resolve-card";
import {
  BAND_ASPECT, PAD_LEFT, PAD_RIGHT, IMG, GAP,
  NAME_BASE, TITLE_BASE, COMPANY_BASE,
  bandPx, bandVariant, initialsOf, bandBackground,
} from "@/lib/wallet-band";

// ── The SwiftCard Apple Wallet pass, drawn in the DOM ───────────────────────
//
// A picture of the REAL pass, not an impression of one. Anywhere the product
// shows someone what they get in Wallet, it shows this — so the promise and
// the download are the same object.
//
// It is faithful because it is derived, not copied. The colours come from
// passPalette(), the same function the pass generator calls; the band's
// proportions come from lib/wallet-band.ts, the same constants Satori renders
// the real strip at; and the three blocks below are what lib/wallet.ts
// actually puts in the pass:
//
//   1. the strip — the band, composed from the card's own parts
//   2. two secondary fields — PHONE and EMAIL, on the colour the band ends on
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
    style: {},
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
  const { ink, inkMuted, accent, voice } = palette;
  const variant = bandVariant(palette.prefer, !!card.photoUrl, !!card.logoUrl);
  const px = (at3x: number) => bandPx(width, at3x);

  const lead = px(IMG);
  // Apple's barcode block: a ~150pt white square in a 375pt pass. The QR
  // inside it is that box minus its quiet zone.
  const qr = Math.round(width * 0.38);

  const field = (label: string, value: string) => (
    <div style={{ minWidth: 0, flex: 1 }}>
      <p style={{
        margin: 0, fontSize: Math.max(6.5, px(26)), fontWeight: 600, color: accent,
        letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1.2,
      }}>{label}</p>
      <p style={{
        margin: `${px(6)}px 0 0`, fontSize: Math.max(8, px(30)), fontWeight: 500, color: ink,
        lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{value}</p>
    </div>
  );

  return (
    <div
      className={className}
      style={{
        width,
        ...(height ? { height, display: "flex", flexDirection: "column" } : {}),
        background: palette.bottom,
        // ~10pt at pass scale. The old 0.055 was nearly twice Apple's radius
        // and read as a widget, not a pass.
        borderRadius: Math.round(width * 0.03),
        overflow: "hidden", boxShadow: "0 12px 28px -10px rgba(15,23,42,0.45)",
      }}
    >
      {/* 0 ── the empty header row Wallet always reserves (see HEADER_H) */}
      <div style={{ height: px(HEADER_H), flex: "none" }} />

      {/* 1 ── the strip */}
      <div style={{
        height: Math.round(width * BAND_ASPECT), flex: "none", background: bandBackground(palette),
        display: "flex", alignItems: "center",
        padding: `0 ${px(PAD_RIGHT)}px 0 ${px(PAD_LEFT)}px`, overflow: "hidden",
      }}>
        {variant === "portrait" ? (
          card.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative preview
            <img src={card.photoUrl} alt="" width={lead} height={lead}
              style={{ width: lead, height: lead, borderRadius: lead, objectFit: "cover", border: `${px(6)}px solid ${accent}`, flex: "none" }} />
          ) : (
            <div style={{
              width: lead, height: lead, borderRadius: lead, border: `${px(6)}px solid ${accent}`,
              flex: "none", background: "rgba(255,255,255,0.14)", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: px(86), fontWeight: 700, color: ink, letterSpacing: "0.01em",
            }}>{initialsOf(card.name)}</div>
          )
        ) : (
          <div style={{
            width: lead, height: lead, borderRadius: px(28), flex: "none",
            background: "rgba(255,255,255,0.12)", display: "flex",
            alignItems: "center", justifyContent: "center", overflow: "hidden",
          }}>
            {card.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative preview
              <img src={card.logoUrl} alt="" style={{ maxWidth: "78%", maxHeight: "78%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: px(88), fontWeight: 700, color: ink, letterSpacing: "0.04em" }}>
                {initialsOf(card.company || card.name)}
              </span>
            )}
          </div>
        )}

        <div style={{ width: px(GAP), flex: "none" }} />

        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, overflow: "hidden" }}>
          <p style={{
            margin: 0, fontSize: px(NAME_BASE), fontWeight: voice.weight, color: ink,
            lineHeight: 1.08, letterSpacing: `${voice.tracking}em`,
            ...(voice.caps ? { textTransform: "uppercase" as const } : {}),
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{card.name || "SwiftCard"}</p>

          {voice.rule ? (
            <span style={{ width: px(104), height: px(7), borderRadius: px(7), background: accent, marginTop: px(16) }} />
          ) : null}

          {card.title ? (
            <p style={{
              margin: `${px(14)}px 0 0`, fontSize: px(TITLE_BASE), color: accent, fontWeight: 600,
              lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{card.title}</p>
          ) : null}

          {card.company ? (
            <p style={{
              margin: `${px(6)}px 0 0`, fontSize: px(COMPANY_BASE), color: inkMuted, fontWeight: 600,
              lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{card.company}</p>
          ) : null}
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

      {/* 3 ── the barcode block. Apple draws it on white, whatever the pass
              colour, because a scanner needs the contrast. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: `${px(20)}px 0 ${px(64)}px`, flex: "none" }}>
        <div style={{ background: "#fff", borderRadius: px(18), padding: px(18), lineHeight: 0 }}>
          <QRCodeSVG value={card.cardUrl} size={qr} bgColor="#ffffff" fgColor="#000000" level="M" />
        </div>
        <p style={{ margin: `${px(14)}px 0 0`, fontSize: Math.max(7, px(25)), color: inkMuted, letterSpacing: "0.01em" }}>
          Scan to connect
        </p>
      </div>
    </div>
  );
}
