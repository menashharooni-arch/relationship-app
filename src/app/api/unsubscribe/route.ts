import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// GET /api/unsubscribe?token=xxx — one-click unsubscribe (RFC 8058 compliant)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/unsubscribe?error=missing", req.url));

  const admin = getAdminSupabase();
  const { error } = await admin
    .from("email_preferences")
    .update({ marketing_emails: false })
    .eq("unsubscribe_token", token);

  if (error) return NextResponse.redirect(new URL("/unsubscribe?error=invalid", req.url));
  return NextResponse.redirect(new URL("/unsubscribe?success=1", req.url));
}

// POST /api/unsubscribe — form submit (also handles List-Unsubscribe-Post header)
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const admin = getAdminSupabase();
  const { error } = await admin
    .from("email_preferences")
    .update({ marketing_emails: false })
    .eq("unsubscribe_token", token);

  if (error) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  return NextResponse.json({ success: true });
}
