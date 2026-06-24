import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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

  if (!file || !field) return NextResponse.json({ error: "Missing file or field" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${field}-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("card-uploads")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage
    .from("card-uploads")
    .getPublicUrl(path);

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
