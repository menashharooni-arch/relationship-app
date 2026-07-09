import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// The official SwiftCard mark: a blue-gradient rounded square with a white
// lightning bolt (matches <SwiftCardIcon> used in the site/portal header).
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          borderRadius: 7,
          background: "linear-gradient(135deg, #2563EB, #0C1F7A)",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 100 100">
          <rect x="11" y="27" width="78" height="52" rx="9" fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="2" />
          <polygon points="57,15 38,52 50,52 43,85 62,48 50,48" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
