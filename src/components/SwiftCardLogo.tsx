type Props = {
  size?: number;
  wordmark?: boolean;
  onDark?: boolean; // true = white text (for dark backgrounds like dashboard nav)
};

export function SwiftCardIcon({ size = 36 }: { size?: number }) {
  return (
    // A 192px source, not the 512px brand-icon.png (138KB) this used to load for
    // a 28-36px mark on every app page. 192px still covers the html-to-image
    // capture path, which renders at 4x (36 x 4 = 144). Same plain <img> — the
    // capture pipeline inlines these, so next/image's srcset is not an option.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand-icon-192.png"
      alt="SwiftCard"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        objectFit: "cover",
        display: "block",
        flexShrink: 0,
      }}
    />
  );
}

export default function SwiftCardLogo({ size = 36, wordmark = true, onDark = false }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
      <SwiftCardIcon size={size} />
      {wordmark && (
        <span
          // A CLASS, not an inline colour: inside a themed .sc-app surface the
          // light theme recolours .text-white to ink (globals.css), so the
          // wordmark follows the page. An inline #ffffff ignored the theme and
          // vanished on the cream join page.
          className={onDark ? "text-white" : "text-gray-900"}
          style={{
            fontSize: size * 0.52,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          SwiftCard
        </span>
      )}
    </div>
  );
}
