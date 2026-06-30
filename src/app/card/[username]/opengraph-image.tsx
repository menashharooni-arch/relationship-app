import { ImageResponse } from "next/og";
import { resolveCardMeta } from "@/lib/resolve-card";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Always reflect the live card (so edits show up in the signature immediately).
export const dynamic = "force-dynamic";

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

  const initials = name.split(" ").map((n) => n[0] ?? "").join("").toUpperCase().slice(0, 2);

  const line = (val: string, fs: number, color: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 14, height: 14, borderRadius: 14, background: accent, flexShrink: 0 }} />
      <div style={{ fontSize: fs, color }}>{val}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff" }}>
        <div style={{ height: 18, background: accent, display: "flex" }} />
        <div style={{ display: "flex", flex: 1, padding: "52px 60px", alignItems: "center", gap: 52 }}>
          {/* Photo / initials */}
          <div style={{ display: "flex", flexShrink: 0 }}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} width={250} height={250} style={{ borderRadius: "50%", objectFit: "cover", border: `8px solid ${accent}` }} />
            ) : (
              <div style={{ width: 250, height: 250, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 104, fontWeight: 800, color: "#fff" }}>
                {initials}
              </div>
            )}
          </div>

          {/* Details — fills the majority of the card with large text */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 82, fontWeight: 800, color: "#0f172a", lineHeight: 1.0 }}>{name}</div>
            {title ? <div style={{ fontSize: 42, color: "#475569", marginTop: 12 }}>{title}</div> : null}
            {company ? <div style={{ fontSize: 40, fontWeight: 700, color: accent, marginTop: 2 }}>{company}</div> : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 30 }}>
              {phone ? line(phone, 38, "#1e293b") : null}
              {email ? line(email, 36, "#334155") : null}
              {website ? line(website, 36, "#334155") : null}
              {address ? line(address, 28, "#64748b") : null}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
