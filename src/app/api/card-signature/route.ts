import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";

const BUCKET = "card-signatures";

// Stores a client-rendered PNG of ONE of the user's cards so it can be hot-linked
// from an email signature (a public, stable URL). One image per card username.
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
  if (buffer.length > 6_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });

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
