import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Official SwiftCard mark — blue-gradient rounded square + white lightning bolt.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          borderRadius: 40,
          background: "linear-gradient(135deg, #2563EB, #0C1F7A)",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 100 100">
          <rect x="11" y="27" width="78" height="52" rx="9" fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
          <polygon points="57,15 38,52 50,52 43,85 62,48 50,48" fill="white" />
          <line x1="15" y1="38" x2="26" y2="38" stroke="white" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
          <line x1="15" y1="46" x2="22" y2="46" stroke="white" strokeOpacity="0.15" strokeWidth="2" strokeLinecap="round" />
          <line x1="15" y1="54" x2="24" y2="54" stroke="white" strokeOpacity="0.1" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
