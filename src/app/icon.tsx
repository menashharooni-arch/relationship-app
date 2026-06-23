import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 7,
        background: "linear-gradient(135deg, #0d1f4e, #060d1f)",
      }}
    >
      {/* Vertical bar */}
      <div style={{
        position: "absolute",
        left: 7,
        top: 5,
        width: 5,
        height: 22,
        borderRadius: 2,
        background: "white",
        display: "flex",
      }} />
      {/* Upper arm */}
      <div style={{
        position: "absolute",
        left: 10,
        top: 5,
        width: 15,
        height: 3,
        borderRadius: 2,
        background: "linear-gradient(to right, white, #60a5fa)",
        transform: "rotate(-35deg)",
        transformOrigin: "left center",
        display: "flex",
      }} />
      {/* Lower arm */}
      <div style={{
        position: "absolute",
        left: 10,
        top: 18,
        width: 15,
        height: 3,
        borderRadius: 2,
        background: "linear-gradient(to right, white, #a78bfa)",
        transform: "rotate(35deg)",
        transformOrigin: "left center",
        display: "flex",
      }} />
    </div>,
    { ...size }
  );
}
