type Props = {
  size?: number;
  wordmark?: boolean;
  dark?: boolean;
};

export function KontactIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="kBg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0d1f4e" />
          <stop offset="100%" stopColor="#060d1f" />
        </linearGradient>
        <linearGradient id="kUpperArm" x1="34" y1="46" x2="76" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="kLowerArm" x1="34" y1="56" x2="76" y2="87" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <filter id="blueGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="purpleGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background rounded square */}
      <rect width="100" height="100" rx="22" fill="url(#kBg)" />

      {/* Subtle inner highlight */}
      <rect width="100" height="100" rx="22" fill="url(#kBg)" opacity="0.6" />
      <rect x="1" y="1" width="98" height="48" rx="21" fill="white" fillOpacity="0.03" />

      {/* K — vertical bar */}
      <rect x="22" y="19" width="13" height="62" rx="5" fill="white" />

      {/* K — upper arm (white → blue) */}
      <line
        x1="32" y1="46"
        x2="76" y2="14"
        stroke="url(#kUpperArm)"
        strokeWidth="11"
        strokeLinecap="round"
      />

      {/* K — lower arm (white → purple) */}
      <line
        x1="32" y1="56"
        x2="76" y2="87"
        stroke="url(#kLowerArm)"
        strokeWidth="11"
        strokeLinecap="round"
      />

      {/* Contact node — top (blue glow) */}
      <circle cx="76" cy="14" r="8" fill="#93c5fd" filter="url(#blueGlow)" />
      <circle cx="76" cy="14" r="5" fill="#60a5fa" />

      {/* Contact node — bottom (purple glow) */}
      <circle cx="76" cy="87" r="8" fill="#c4b5fd" filter="url(#purpleGlow)" />
      <circle cx="76" cy="87" r="5" fill="#a78bfa" />
    </svg>
  );
}

export default function KontactLogo({ size = 36, wordmark = true, dark = false }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.25 }}>
      <KontactIcon size={size} />
      {wordmark && (
        <span
          style={{
            fontSize: size * 0.52,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: dark ? "#111827" : "#ffffff",
            lineHeight: 1,
          }}
        >
          Kontact
        </span>
      )}
    </div>
  );
}
