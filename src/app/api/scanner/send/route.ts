import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isRateLimited } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/escape";
import { sendRawEmail, isOptedOut, contactUnsubUrl } from "@/lib/messaging";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Sends to an arbitrary attacker-chosen address — without a cap this is an
  // unthrottled mail relay via SwiftCard's own sending reputation.
  if (await isRateLimited(`scanner-send:${user.id}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { toEmail } = await request.json() as { toEmail?: string };
  if (!toEmail) return NextResponse.json({ error: "no_email" }, { status: 400 });

  // Same opt-out check every other lead-facing email in the app respects —
  // a recipient who's unsubscribed via ANY SwiftCard user's email must not
  // get a new one just because a different user scanned their card.
  if (await isOptedOut("email", toEmail)) {
    return NextResponse.json({ error: "opted_out", message: "This person has opted out of emails." }, { status: 409 });
  }

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
  const safeFirstName = escapeHtml(firstName);

  const result = await sendRawEmail({
    to: toEmail,
    fromName: firstName,
    subject: `${firstName} shared their contact card with you`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;">
        <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">Hi,</p>
        <p style="font-size:15px;color:#334155;line-height:1.6;margin:0 0 24px;">
          ${safeFirstName} shared their digital business card with you. Save their contact in one tap:
        </p>
        <a href="${cardUrl}"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 28px;border-radius:99px;font-size:14px;font-weight:600;">
          View ${safeFirstName}&apos;s card
        </a>
        <p style="font-size:12px;color:#94a3b8;margin-top:32px;">
          Sent via <a href="${APP_URL}" style="color:#94a3b8;">SwiftCard</a> ·
          <a href="${contactUnsubUrl(toEmail)}" style="color:#94a3b8;">Unsubscribe</a>
        </p>
      </div>
    `,
  });

  if (result !== "sent") {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
