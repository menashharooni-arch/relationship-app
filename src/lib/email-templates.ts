const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://relationship-app-alpha.vercel.app";
const FROM = process.env.RESEND_FROM_EMAIL || "SwiftCard <onboarding@resend.dev>";

// ─── Shared layout wrapper ────────────────────────────────────────────────────
function layout(body: string, unsubscribeUrl?: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;min-height:100vh;padding:40px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;">

  <!-- Logo -->
  <tr><td style="padding-bottom:32px;">
    <span style="font-size:11px;font-weight:800;letter-spacing:0.2em;color:#94a3b8;text-transform:uppercase;">SwiftCard</span>
  </td></tr>

  <!-- Body -->
  <tr><td>${body}</td></tr>

  <!-- Footer -->
  <tr><td style="padding-top:40px;border-top:1px solid #E4DDD4;margin-top:40px;">
    <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">
      SwiftCard · 123 Business Ave, Los Angeles, CA 90001<br>
      ${unsubscribeUrl
        ? `<a href="${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> from marketing emails`
        : "You are receiving this because you have an account with SwiftCard."}
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// ─── Template helpers ─────────────────────────────────────────────────────────
function h1(text: string) {
  return `<h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;line-height:1.2;">${text}</h1>`;
}
function p(text: string) {
  return `<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.65;">${text}</p>`;
}
function btn(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#1D4ED8;color:#fff;text-decoration:none;padding:13px 28px;border-radius:99px;font-size:14px;font-weight:700;margin:8px 0 24px;">${label}</a>`;
}
function card(html: string) {
  return `<div style="background:#EDE5D8;border:1px solid #D4C8B8;border-radius:16px;padding:20px 24px;margin:0 0 24px;">${html}</div>`;
}
function row(label: string, value: string) {
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid #E4DDD4;font-size:13px;color:#64748b;width:140px;">${label}</td>
    <td style="padding:9px 0;border-bottom:1px solid #E4DDD4;font-size:13px;color:#0f172a;font-weight:600;">${value}</td>
  </tr>`;
}

// ─── Email builders ───────────────────────────────────────────────────────────

export function welcomeEmail(opts: {
  firstName: string;
  cardUrl: string;
  unsubscribeUrl: string;
}) {
  const body = `
    ${h1(`Your SwiftCard is live, ${opts.firstName}! 🎉`)}
    ${p("Share it anywhere — a link, a QR code, or tap your phone. Every time someone shares their info back, they land in your dashboard automatically.")}
    ${card(`
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;color:#94a3b8;text-transform:uppercase;">Your card link</p>
      <a href="${opts.cardUrl}" style="color:#1D4ED8;font-size:15px;font-weight:600;text-decoration:none;">${opts.cardUrl}</a>
    `)}
    ${btn(opts.cardUrl, "See my live card →")}
    ${card(`
      <p style="margin:0 0 14px;font-weight:700;color:#0f172a;font-size:14px;">3 ways to share your card</p>
      <p style="margin:0 0 8px;font-size:13px;color:#475569;">📱 <strong>Text the link</strong> — paste into any chat</p>
      <p style="margin:0 0 8px;font-size:13px;color:#475569;">📸 <strong>QR code</strong> — download from your dashboard and add to your email signature or slide deck</p>
      <p style="margin:0;font-size:13px;color:#475569;">✉️ <strong>Email signature</strong> — add "Save my contact → ${opts.cardUrl}"</p>
    `)}
  `;
  return {
    from: FROM,
    subject: `Your SwiftCard is live, ${opts.firstName}!`,
    html: layout(body, opts.unsubscribeUrl),
  };
}

export function promoEmail(opts: {
  firstName: string;
  code: string;
  discountText: string;
  headline: string;
  body: string;
  unsubscribeUrl: string;
}) {
  const body = `
    <div style="background:#1D4ED8;border-radius:12px;padding:4px 14px;display:inline-block;margin-bottom:20px;">
      <span style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Exclusive offer</span>
    </div>
    ${h1(opts.headline)}
    ${p(opts.body)}
    ${card(`
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;color:#94a3b8;text-transform:uppercase;">Your promo code</p>
      <p style="margin:0 0 4px;font-size:28px;font-weight:900;color:#1D4ED8;letter-spacing:0.06em;">${opts.code}</p>
      <p style="margin:0;font-size:13px;color:#64748b;">${opts.discountText}</p>
    `)}
    ${btn(`${APP_URL}/pricing?code=${opts.code}`, `Apply code & upgrade →`)}
    ${p(`Apply it at checkout on the pricing page. If you have any questions, just reply to this email.`)}
  `;
  return {
    from: FROM,
    subject: opts.headline,
    html: layout(body, opts.unsubscribeUrl),
  };
}

export function receiptEmail(opts: {
  firstName: string;
  email: string;
  planName: string;
  amount: string;
  interval: string;
  paymentDate: string;
  invoiceNumber: string;
  invoiceUrl?: string;
  manageUrl: string;
}) {
  const tableRows = [
    row("Plan", opts.planName),
    row("Amount", opts.amount),
    row("Billing", opts.interval),
    row("Date", opts.paymentDate),
    row("Receipt #", opts.invoiceNumber),
  ].join("");

  const body = `
    <div style="margin-bottom:24px;">
      <div style="width:48px;height:48px;background:#EEF2FF;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
        <span style="font-size:22px;">✅</span>
      </div>
      ${h1(`Payment confirmed`)}
      ${p(`Thank you, ${opts.firstName}. Your payment was processed successfully. Here's your receipt.`)}
    </div>
    <div style="background:#fff;border:1px solid #E4DDD4;border-radius:16px;overflow:hidden;margin-bottom:24px;">
      <div style="background:#0f172a;padding:16px 24px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.15em;color:#64748b;text-transform:uppercase;">Receipt</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#fff;">SwiftCard ${opts.planName}</p>
      </div>
      <div style="padding:0 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">${tableRows}</table>
      </div>
    </div>
    ${opts.invoiceUrl ? btn(opts.invoiceUrl, "Download invoice PDF →") : ""}
    ${card(`
      <p style="margin:0 0 8px;font-weight:700;color:#0f172a;font-size:13px;">Manage your subscription</p>
      <p style="margin:0 0 12px;font-size:13px;color:#64748b;">Cancel, change plan, or update payment info at any time.</p>
      <a href="${opts.manageUrl}" style="color:#1D4ED8;font-size:13px;font-weight:600;text-decoration:none;">Manage billing →</a>
    `)}
    ${p(`If you have any questions about this charge, just reply to this email.`)}
  `;
  return {
    from: FROM,
    subject: `Your SwiftCard receipt — ${opts.amount}`,
    html: layout(body),
  };
}

export function marketingEmail(opts: {
  firstName: string;
  subject: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  unsubscribeUrl: string;
}) {
  const emailBody = `
    ${h1(opts.headline)}
    ${p(opts.body)}
    ${btn(opts.ctaUrl, opts.ctaLabel)}
  `;
  return {
    from: FROM,
    subject: opts.subject,
    html: layout(emailBody, opts.unsubscribeUrl),
  };
}

// ─── Unsubscribe URL helper ───────────────────────────────────────────────────
export function unsubUrl(token: string) {
  return `${APP_URL}/unsubscribe?token=${token}`;
}
