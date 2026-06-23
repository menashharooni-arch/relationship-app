import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 40,
        background: "linear-gradient(135deg, #0d1f4e, #060d1f)",
      }}
    >
      {/* Vertical bar */}
      <div style={{
        position: "absolute",
        left: 42,
        top: 30,
        width: 26,
        height: 120,
        borderRadius: 8,
        background: "white",
        display: "flex",
      }} />
      {/* Upper arm */}
      <div style={{
        position: "absolute",
        left: 58,
        top: 24,
        width: 82,
        height: 16,
        borderRadius: 8,
        background: "linear-gradient(to right, white, #60a5fa)",
        transform: "rotate(-34deg)",
        transformOrigin: "left center",
        display: "flex",
      }} />
      {/* Lower arm */}
      <div style={{
        position: "absolute",
        left: 58,
        top: 103,
        width: 82,
        height: 16,
        borderRadius: 8,
        background: "linear-gradient(to right, white, #a78bfa)",
        transform: "rotate(34deg)",
        transformOrigin: "left center",
        display: "flex",
      }} />
      {/* Top dot */}
      <div style={{
        position: "absolute",
        right: 22,
        top: 22,
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "#60a5fa",
        display: "flex",
      }} />
      {/* Bottom dot */}
      <div style={{
        position: "absolute",
        right: 22,
        bottom: 22,
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "#a78bfa",
        display: "flex",
      }} />
    </div>,
    { ...size }
  );
}
