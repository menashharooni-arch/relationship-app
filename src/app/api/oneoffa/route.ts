import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// TEMPORARY diagnostic: is ADMIN_EMAILS set correctly + is the current user an admin?
const TOKEN = "sc-oneoff-3a8k6w1p";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) return NextResponse.json({ error: "nope" }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({
    adminEmailsConfigured: ADMIN_EMAILS,
    includesHello: ADMIN_EMAILS.includes("hello@swiftcard.me"),
    includesMenash: ADMIN_EMAILS.includes("menashharooni@gmail.com"),
    currentUserEmail: user?.email ?? null,
    currentUserIsAdmin: !!user && ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? ""),
  });
}
