import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";

const BUCKET = "card-shares";

// Stores a client-rendered, pixel-perfect PNG of the user's card EXACTLY as it
// looks on the public card page. The card's share-link preview (Open Graph
// image) serves this file, so the link unfurls with a real picture of the card.
// One image per card username.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { dataUrl, username } = (await req.json().catch(() => ({}))) as { dataUrl?: string; username?: string };
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) {
    return NextResponse.json({ error: "bad image" }, { status: 400 });
  }
  if (typeof username !== "string" || !/^[a-z0-9-]{1,40}$/i.test(username)) {
    return NextResponse.json({ error: "bad username" }, { status: 400 });
  }
  // The card must belong to this user.
  const owned = await getOwnerUsernames(user.id);
  if (!owned.includes(username)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
  if (buffer.length > 12_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });

  // Defense in depth: only accept CARD-SHAPED PNGs (landscape ~1.35–1.75:1,
  // wider when the card grows taller). A square/portrait upload means the
  // client capture failed mid-layout — storing it would make the share
  // preview show a wrong picture on every messenger, so reject it here too.
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0x89504e47) {
    return NextResponse.json({ error: "not a png" }, { status: 400 });
  }
  const pngW = buffer.readUInt32BE(16);
  const pngH = buffer.readUInt32BE(20);
  const ratio = pngW / Math.max(1, pngH);
  if (pngW < 300 || ratio < 1.25 || ratio > 2.4) {
    return NextResponse.json({ error: "not card-shaped" }, { status: 400 });
  }

  const admin = getAdminSupabase();
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {}); // idempotent

  const path = `${username}.png`;
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: "image/png",
    upsert: true,
    cacheControl: "60",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: `${pub.publicUrl}?v=${Date.now()}` });
}
