import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>",
      to: "bharooni10@gmail.com",
      replyTo: email,
      subject: `SwiftCard contact form: ${subject || "New message"}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:0.2em;color:#6b7280;text-transform:uppercase;margin:0 0 24px;">KONTACT — Contact Form</p>
          <h2 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 24px;">${subject || "New contact message"}</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr><td style="padding:8px 0;font-size:13px;color:#6b7280;width:80px;">From</td><td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:600;">${name}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#6b7280;">Email</td><td style="padding:8px 0;font-size:13px;color:#1D4ED8;">${email}</td></tr>
            ${subject ? `<tr><td style="padding:8px 0;font-size:13px;color:#6b7280;">Subject</td><td style="padding:8px 0;font-size:13px;color:#0f172a;">${subject}</td></tr>` : ""}
          </table>
          <div style="background:#F0EBE1;border:1px solid #E4DDD4;border-radius:12px;padding:20px 24px;">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${message}</p>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px;">Reply directly to this email to respond to ${name}.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  }
}
