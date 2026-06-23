import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase-server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email, username")
      .eq("id", user.id)
      .single();

    if (!profile?.email) return NextResponse.json({ error: "No profile" }, { status: 404 });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const firstName = profile.name.split(" ")[0];
    const cardUrl = `${APP_URL}/card/${profile.username}`;
    const dashUrl = `${APP_URL}/dashboard`;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Kontact <onboarding@resend.dev>",
      to: profile.email,
      subject: `Your Kontact is live, ${firstName}! 🎉`,
      html: `
        <div style="background:#030712;min-height:100vh;padding:48px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="max-width:520px;margin:0 auto;">

            <p style="font-size:11px;font-weight:700;letter-spacing:0.2em;color:#4b5563;text-transform:uppercase;margin:0 0 32px;">EVERCARD</p>

            <h1 style="font-size:28px;font-weight:700;color:#ffffff;margin:0 0 12px;">
              Your card is live, ${firstName}! 🎉
            </h1>
            <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 32px;">
              Share it anywhere — a link, a QR code, or tap your phone. Every time someone shares their info back, they land in your dashboard automatically.
            </p>

            <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:20px 24px;margin:0 0 32px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.15em;color:#4b5563;text-transform:uppercase;">Your card link</p>
              <a href="${cardUrl}" style="color:#60a5fa;font-size:16px;font-weight:600;text-decoration:none;">${cardUrl}</a>
            </div>

            <div style="margin:0 0 40px;">
              <a href="${cardUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:99px;font-size:14px;font-weight:600;margin-right:12px;">
                See my card →
              </a>
              <a href="${dashUrl}" style="display:inline-block;color:#9ca3af;text-decoration:none;padding:14px 0;font-size:14px;">
                Go to dashboard
              </a>
            </div>

            <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px;">
              <p style="margin:0 0 16px;font-weight:600;color:#ffffff;font-size:15px;">3 ways to share your card</p>
              <p style="margin:0 0 10px;color:#9ca3af;font-size:14px;line-height:1.5;">
                📱 <strong style="color:#e5e7eb;">Text the link</strong> — copy and paste it into any chat
              </p>
              <p style="margin:0 0 10px;color:#9ca3af;font-size:14px;line-height:1.5;">
                📸 <strong style="color:#e5e7eb;">Download your QR code</strong> — add it to your email signature, slide deck, or print it
              </p>
              <p style="margin:0;color:#9ca3af;font-size:14px;line-height:1.5;">
                ✍️ <strong style="color:#e5e7eb;">Add it to your email signature</strong> — "Save my contact → ${cardUrl}"
              </p>
            </div>

            <p style="color:#374151;font-size:12px;margin-top:40px;border-top:1px solid #111827;padding-top:20px;">
              Kontact automatically follows up on your leads at day 1, 15, and 30.
              You'll get an email reminder each time.
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Welcome email error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
