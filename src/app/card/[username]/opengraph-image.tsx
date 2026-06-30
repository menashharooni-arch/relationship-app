import { ImageResponse } from "next/og";
import { resolveCardMeta } from "@/lib/resolve-card";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const p = await resolveCardMeta(username);

  const name = p?.name ?? "SwiftCard";
  const title = p?.title ?? "";
  const company = p?.company ?? "";
  const photoUrl = p?.photoUrl ?? null;
  const phone = p?.phone ?? "";
  const email = p?.email ?? "";
  const website = (p?.website ?? "").replace(/^https?:\/\//, "");
  const address = p?.address ?? "";
  const accent = p?.accentColor || "#2563eb";

  const initials = name
    .split(" ")
    .map((n: string) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const contactRow = (value: string, big = true) => (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 12, height: 12, borderRadius: 12, background: accent, flexShrink: 0 }} />
      <div style={{ fontSize: big ? 30 : 24, color: big ? "#334155" : "#94a3b8" }}>{value}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
        }}
      >
        {/* Accent top bar */}
        <div style={{ height: 16, background: accent, display: "flex" }} />

        <div style={{ display: "flex", flex: 1, padding: "64px 72px", alignItems: "center", gap: 56 }}>
          {/* Photo / initials */}
          <div style={{ display: "flex", flexShrink: 0 }}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                width={220}
                height={220}
                style={{ borderRadius: "50%", objectFit: "cover", border: `6px solid ${accent}` }}
              />
            ) : (
              <div
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  background: accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 88,
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Details */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontSize: 70, fontWeight: 800, color: "#0f172a", lineHeight: 1.05 }}>{name}</div>
            {title ? <div style={{ fontSize: 36, color: "#475569", marginTop: 8 }}>{title}</div> : null}
            {company ? <div style={{ fontSize: 34, fontWeight: 700, color: accent, marginTop: 2 }}>{company}</div> : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}>
              {phone ? contactRow(phone) : null}
              {email ? contactRow(email) : null}
              {website ? contactRow(website) : null}
              {address ? contactRow(address, false) : null}
            </div>
          </div>
        </div>

        {/* Subtle brand mark */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 72px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 22, fontWeight: 700 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: accent, display: "flex" }} />
            SwiftCard
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
