import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";

const FREE_LEAD_LIMIT = 25;

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, message, card_owner } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    // Extract location from Vercel's built-in geo headers (no API key needed)
    const city = req.headers.get("x-vercel-ip-city");
    const country = req.headers.get("x-vercel-ip-country");
    const location = city && country
      ? `${decodeURIComponent(city)}, ${country}`
      : country || null;

    const supabase = getSupabase();

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("plan, name, email, phone, company")
      .eq("username", card_owner)
      .single();

    if (ownerProfile?.plan !== "pro" && ownerProfile?.plan !== "enterprise") {
      const { count } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("card_owner", card_owner);

      if ((count ?? 0) >= FREE_LEAD_LIMIT) {
        return NextResponse.json(
          { error: "limit", message: "This card has reached its free plan limit." },
          { status: 402 }
        );
      }
    }

    const { error } = await supabase
      .from("leads")
      .insert({
        name,
        email,
        phone: phone || null,
        message: message || null,
        location: location || null,
        card_owner,
      });

    if (error) {
      console.error("Supabase insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send instant confirmation email to the lead
    if (ownerProfile?.name && ownerProfile?.email) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const ownerFirst = ownerProfile.name.split(" ")[0];
      const leadFirst = name.split(" ")[0];

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Kontact <onboarding@resend.dev>",
        replyTo: ownerProfile.email,
        to: email,
        subject: `Great connecting with you, ${leadFirst}! — ${ownerFirst}`,
        html: `
          <div style="background:#ffffff;padding:48px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:480px;margin:0 auto;">
              <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 16px;">
                Hey ${leadFirst}! 👋
              </h2>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
                It was so great meeting you. I just wanted to make sure you have my contact info saved — feel free to reach out anytime.
              </p>

              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-weight:700;color:#111827;font-size:15px;">${ownerProfile.name}</p>
                ${ownerProfile.company ? `<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">${ownerProfile.company}</p>` : ""}
                <a href="mailto:${ownerProfile.email}" style="display:block;color:#2563eb;font-size:13px;margin:0 0 4px;">${ownerProfile.email}</a>
                ${ownerProfile.phone ? `<a href="tel:${ownerProfile.phone}" style="display:block;color:#2563eb;font-size:13px;">${ownerProfile.phone}</a>` : ""}
              </div>

              <p style="color:#6b7280;font-size:13px;margin:0;">
                Looking forward to keeping in touch!<br/>
                <strong style="color:#111827;">${ownerFirst}</strong>
              </p>

              <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f3f4f6;">
                <p style="color:#9ca3af;font-size:11px;margin:0;">Sent via <a href="https://relationship-app-alpha.vercel.app" style="color:#9ca3af;">Kontact</a></p>
              </div>
            </div>
          </div>
        `,
      }).catch(() => {}); // non-blocking
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("API route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
