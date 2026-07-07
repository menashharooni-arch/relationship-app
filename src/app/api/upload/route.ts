import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

// sharp (image resizing) needs the Node runtime.
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const field = body.field as string | undefined; // "photo" or "logo"
  const cardId = body.card_id as string | undefined;

  // Clear a per-card logo.
  if (field === "logo" && cardId) {
    const admin = getAdminSupabase();
    const { error } = await admin.from("cards").update({ logo_url: null }).eq("id", cardId).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Clear the account-level photo or logo.
  const column = field === "photo" ? "photo_url" : "logo_url";
  const { error } = await supabase.from("profiles").update({ [column]: null }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const field = formData.get("field") as string | null; // "photo" or "logo"
  const cardId = formData.get("card_id") as string | null;
  const defer = formData.get("defer") as string | null; // "true" = just return the URL, write nothing

  if (!file || !field) return NextResponse.json({ error: "Missing file or field" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });

  // Resize + compress at upload. Phone photos arrive at 3-5MB / 4000px+ — storing
  // originals made every card page, signature and share capture slow. 1000px is
  // ~3x the largest display size, so everything stays retina-sharp, never blurry.
  //   photo → JPEG (q85, EXIF-rotated)   logo → PNG (keeps transparency)
  //   gif  → passthrough (may be animated)
  const arrayBuffer = await file.arrayBuffer();
  let body: ArrayBuffer | Buffer = arrayBuffer;
  let contentType = file.type;
  let ext = file.name.split(".").pop() ?? "jpg";
  if (file.type !== "image/gif") {
    try {
      const sharp = (await import("sharp")).default;
      const MAXDIM = field === "photo" ? 1000 : 800;
      const img = sharp(Buffer.from(arrayBuffer)).rotate().resize(MAXDIM, MAXDIM, { fit: "inside", withoutEnlargement: true });
      if (field === "logo") {
        body = await img.png({ compressionLevel: 9 }).toBuffer();
        contentType = "image/png";
        ext = "png";
      } else {
        body = await img.jpeg({ quality: 85 }).toBuffer();
        contentType = "image/jpeg";
        ext = "jpg";
      }
    } catch {
      // sharp failure → store the original rather than fail the upload.
      body = arrayBuffer;
      contentType = file.type;
    }
  }

  const path = `${user.id}/${field}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("card-uploads")
    .upload(path, body, { contentType, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage
    .from("card-uploads")
    .getPublicUrl(path);

  // Deferred upload (e.g. while creating a card that doesn't exist yet): just return
  // the URL so the caller can persist it when the row is created.
  if (defer === "true") {
    return NextResponse.json({ url: publicUrl });
  }

  // If field is "logo" and card_id is provided, save to cards table instead
  if (field === "logo" && cardId) {
    const admin = getAdminSupabase();
    const { error: cardUpdateError } = await admin
      .from("cards")
      .update({ logo_url: publicUrl })
      .eq("id", cardId)
      .eq("user_id", user.id);
    if (cardUpdateError) return NextResponse.json({ error: cardUpdateError.message }, { status: 500 });
    return NextResponse.json({ url: publicUrl });
  }

  // Save url directly to the correct profile column
  const column = field === "photo" ? "photo_url" : "logo_url";
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ [column]: publicUrl })
    .eq("id", user.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ url: publicUrl });
}
