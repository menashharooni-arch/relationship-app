import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const admin = getAdminSupabase();

  const { error } = await admin
    .from("email_preferences")
    .upsert(
      {
        user_id: user.id,
        marketing_emails: body.marketing_emails ?? true,
        receipt_emails: body.receipt_emails ?? true,
      },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data } = await admin
    .from("email_preferences")
    .select("marketing_emails, receipt_emails")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    marketing_emails: data?.marketing_emails ?? true,
    receipt_emails: data?.receipt_emails ?? true,
  });
}
