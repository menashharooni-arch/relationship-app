type Props = {
  size?: number;
  wordmark?: boolean;
  onDark?: boolean; // true = white text (for dark backgrounds like dashboard nav)
};

export function SwiftCardIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="scBg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#0C1F7A" />
        </linearGradient>
        <filter id="boltGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background rounded square */}
      <rect width="100" height="100" rx="22" fill="url(#scBg)" />

      {/* Top-left shine */}
      <rect x="1" y="1" width="98" height="44" rx="21" fill="white" fillOpacity="0.05" />

      {/* Card outline — subtle */}
      <rect
        x="11" y="27" width="78" height="52" rx="9"
        fill="none"
        stroke="white"
        strokeOpacity="0.15"
        strokeWidth="1.5"
      />

      {/* Lightning bolt — centered, white */}
      <polygon
        points="57,15 38,52 50,52 43,85 62,48 50,48"
        fill="white"
        opacity="0.95"
        filter="url(#boltGlow)"
      />

      {/* Speed lines — top-left accent */}
      <line x1="15" y1="38" x2="26" y2="38" stroke="white" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="46" x2="22" y2="46" stroke="white" strokeOpacity="0.15" strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="54" x2="24" y2="54" stroke="white" strokeOpacity="0.1" strokeWidth="2" strokeLinecap="round" />
    </svg>
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
