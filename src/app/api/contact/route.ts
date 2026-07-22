import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { escapeHtml } from "@/lib/escape";
import { isRateLimited } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }

    // This is public + unauthenticated — rate-limit per IP so it can't be used
    // to flood the staff inbox or burn the Resend quota.
    const ip = clientIp(req);
    if (await isRateLimited(`contact:${ip}`)) {
      return NextResponse.json({ error: "Too many messages. Please wait a few minutes." }, { status: 429 });
    }

    // Escape all three fields — a crafted name/message must not inject markup or
    // a phishing link into the staff inbox.
    const eName = escapeHtml(name);
    const eEmail = escapeHtml(email);
    const eMessage = escapeHtml(message);

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>",
      to: "hello@swiftcard.me",
      replyTo: email,
      subject: `SwiftCard contact form — ${name}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:0.2em;color:#6b7280;text-transform:uppercase;margin:0 0 24px;">SwiftCard — Contact Form</p>
          <h2 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 24px;">New message from ${eName}</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr><td style="padding:8px 0;font-size:13px;color:#6b7280;width:80px;">From</td><td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:600;">${eName}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#6b7280;">Email</td><td style="padding:8px 0;font-size:13px;color:#1D4ED8;">${eEmail}</td></tr>
          </table>
          <div style="background:#F0EBE1;border:1px solid #E4DDD4;border-radius:12px;padding:20px 24px;">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${eMessage}</p>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px;">Reply directly to this email to respond to ${eName}.</p>
        </div>
      `,
      // Plain-text alternative (multipart/alternative) — uses the raw, unescaped
      // values since text/plain is not HTML.
      text: `New message from ${name}\n\nFrom: ${name}\nEmail: ${email}\n\n${message}\n\nReply directly to this email to respond.`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  }
}
