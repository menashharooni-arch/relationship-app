import { ImageResponse } from "next/og";
import { getAdminSupabase } from "@/lib/supabase-admin";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const admin = getAdminSupabase();

  const { data: profileData } = await admin
    .from("profiles")
    .select("name, title, company, photo_url")
    .eq("username", username)
    .single();

  const { data: cardData } = !profileData
    ? await admin
        .from("cards")
        .select("name, title, company, photo_url")
        .eq("username", username)
        .single()
    : { data: null };

  const p = profileData ?? cardData;
  const name = p?.name ?? username;
  const title = p?.title ?? "";
  const company = p?.company ?? "";
  const photoUrl = p?.photo_url ?? null;
  const initials = name
    .split(" ")
    .map((n: string) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0f172a",
          padding: "72px 80px",
          justifyContent: "space-between",
        }}
      >
        {/* Main content row */}
        <div style={{ display: "flex", alignItems: "center", gap: 56, flex: 1 }}>
          {/* Avatar */}
          <div style={{ display: "flex", flexShrink: 0 }}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                width={190}
                height={190}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "4px solid #3b82f6",
                }}
              />
            ) : (
              <div
                style={{
                  width: 190,
                  height: 190,
                  borderRadius: "50%",
                  background: "#1D4ED8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 68,
                  fontWeight: 800,
                  color: "#fff",
                  border: "4px solid #3b82f6",
                }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                fontSize: 68,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.05,
              }}
            >
              {name}
            </div>
            {title && (
              <div style={{ fontSize: 34, color: "#94a3b8", fontWeight: 500 }}>
                {title}
              </div>
            )}
            {company && (
              <div style={{ fontSize: 28, color: "#64748b" }}>{company}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: "#1D4ED8",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              S
            </div>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#475569" }}>
              SwiftCard
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#1D4ED820",
              border: "1px solid #1D4ED840",
              borderRadius: 999,
              padding: "10px 22px",
              color: "#60a5fa",
              fontSize: 20,
            }}
          >
            Tap to connect →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
