import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { toEmail } = await request.json() as { toEmail?: string };
  if (!toEmail) return NextResponse.json({ error: "no_email" }, { status: 400 });

  const adminSupabase = getAdminSupabase();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("name, username, plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "pro" && profile?.plan !== "enterprise") {
    return NextResponse.json({ error: "pro_required" }, { status: 403 });
  }

  const cardUrl = `${APP_URL}/card/${profile.username}`;
  const firstName = profile.name?.split(" ")[0] ?? "Someone";

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>",
    to: toEmail,
    subject: `${firstName} shared their contact card with you`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;">
        <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">Hi,</p>
        <p style="font-size:15px;color:#334155;line-height:1.6;margin:0 0 24px;">
          ${firstName} shared their digital business card with you. Save their contact in one tap:
        </p>
        <a href="${cardUrl}"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 28px;border-radius:99px;font-size:14px;font-weight:600;">
          View ${firstName}&apos;s card
        </a>
        <p style="font-size:12px;color:#94a3b8;margin-top:32px;">
          Sent via <a href="${APP_URL}" style="color:#94a3b8;">SwiftCard</a>
        </p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
