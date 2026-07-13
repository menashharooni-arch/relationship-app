type Props = {
  size?: number;
  wordmark?: boolean;
  onDark?: boolean; // true = white text (for dark backgrounds like dashboard nav)
};

export function SwiftCardIcon({ size = 36 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand-icon.png"
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
          style={{
            fontSize: size * 0.52,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: onDark ? "#ffffff" : "#111827",
            lineHeight: 1,
          }}
        >
          SwiftCard
        </span>
      )}
    </div>
  );
}
