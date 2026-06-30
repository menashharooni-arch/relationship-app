import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

const BUCKET = "card-signatures";

// Stores a client-rendered PNG of the user's actual card so it can be hot-linked
// from an email signature (a public, stable URL). Overwrites per user.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { dataUrl } = (await req.json().catch(() => ({}))) as { dataUrl?: string };
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) {
    return NextResponse.json({ error: "bad image" }, { status: 400 });
  }
  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
  if (buffer.length > 6_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });

  const admin = getAdminSupabase();
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {}); // idempotent

  const path = `${user.id}.png`;
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: "image/png",
    upsert: true,
    cacheControl: "60",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  // Bust caches when the user regenerates after editing their card.
  return NextResponse.json({ url: `${pub.publicUrl}?v=${Date.now()}` });
}
