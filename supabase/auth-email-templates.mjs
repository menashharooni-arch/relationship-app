// ── The emails Supabase Auth sends for SwiftCard ─────────────────────────────
// Sign-up confirmation, sign-in link (team invitees), password reset, email
// change, and invite. Applied to the project by scripts/supabase-auth-emails.mjs
// (Management API → auth config); this file is the source of truth, so the
// dashboard should never be edited by hand — change it here and re-run.
//
// Why they exist (2026-09-22 Office sign-up review): Supabase's defaults went
// out with no SwiftCard name anywhere, a bare "Sign in" link, and that link
// pointed at grxmovpmlgmjncnyiyrt.supabase.co — the exact shape of a phishing
// email, arriving at the moment someone is deciding whether to trust us.
//
// Rules every template keeps:
//   • Every link is on https://swiftcard.me — never {{ .ConfirmationURL }},
//     which is the supabase.co address. Hardcoded rather than {{ .SiteURL }}
//     so a dashboard setting can't quietly move it.
//   • Sign-in/confirm links go to /auth/confirm with the token hash, verified
//     server-side, so they work in any browser (see src/app/auth/confirm).
//     `redirect_to={{ .RedirectTo }}` is ALWAYS the last parameter (and `&`
//     is written `&amp;`, which is correct HTML and decodes to `&` in the link) —
//     src/lib/auth-confirm.ts reads it from the raw query string.
//   • The address the button goes to is also printed as text, the same
//     anti-phishing habit as the team invite email.
//   • Same look as the rest of SwiftCard's mail (lib/email-templates layout).
//
// Plain JS with no imports so both the Node script and the tests can load it.

export const SITE = "https://swiftcard.me";
const POSTAL = "Swift Card Inc · New York, NY";

const confirmLink = (type) =>
  `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;redirect_to={{ .RedirectTo }}`;

function layout({ heading, intro, button, href, after }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FAF7F2;padding:40px 16px;">
<tr><td align="center">
<table width="100%" role="presentation" style="max-width:520px;">
  <tr><td style="padding-bottom:32px;">
    <img src="${SITE}/brand-icon.png" width="28" height="28" alt="" style="vertical-align:middle;border-radius:7px;margin-right:8px;" />
    <span style="font-size:13px;font-weight:800;letter-spacing:0.02em;color:#111827;vertical-align:middle;">SwiftCard</span>
  </td></tr>
  <tr><td>
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;line-height:1.2;">${heading}</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.65;">${intro}</p>
    <a href="${href}" style="display:inline-block;background:#1D4ED8;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:99px;font-size:14px;font-weight:700;margin:8px 0 12px;">${button}</a>
    <p style="margin:0 0 24px;font-size:12px;color:#94a3b8;line-height:1.6;">This link goes to swiftcard.me and works once. ${after}</p>
  </td></tr>
  <tr><td style="padding-top:32px;border-top:1px solid #E4DDD4;">
    <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">${POSTAL}</p>
    <p style="margin:4px 0 0;color:#b6bcc6;font-size:10px;line-height:1.5;">You're receiving this because this email address was used on SwiftCard. If that wasn't you, you can ignore it.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/** Keyed by the Management API's mailer_* names (…_confirmation, …_magic_link, …). */
export const AUTH_EMAILS = {
  confirmation: {
    subject: "Confirm your email for SwiftCard",
    content: layout({
      heading: "Confirm your email",
      intro: "Tap the button below to confirm {{ .Email }} and finish creating your SwiftCard account. You'll go straight back to where you left off.",
      button: "Confirm my email →",
      href: confirmLink("email"),
      after: "If you didn't create a SwiftCard account, you can ignore this email.",
    }),
  },
  magic_link: {
    subject: "Your SwiftCard sign-in link",
    content: layout({
      heading: "Sign in to SwiftCard",
      intro: "Tap the button below to sign in as {{ .Email }}. No password needed.",
      button: "Sign in to SwiftCard →",
      href: confirmLink("email"),
      after: "It expires soon. If you didn't ask to sign in, you can ignore this email.",
    }),
  },
  recovery: {
    subject: "Reset your SwiftCard password",
    content: layout({
      heading: "Reset your password",
      intro: "Tap the button below to choose a new password for {{ .Email }}.",
      button: "Choose a new password →",
      // /auth/reset-password verifies its own token_hash (ResetPasswordForm).
      href: `${SITE}/auth/reset-password?token_hash={{ .TokenHash }}&amp;type=recovery`,
      after: "It expires soon. If you didn't ask to reset your password, you can ignore this email — your password stays the same.",
    }),
  },
  email_change: {
    subject: "Confirm your new email for SwiftCard",
    content: layout({
      heading: "Confirm your new email",
      intro: "Tap the button below to change your SwiftCard sign-in email from {{ .Email }} to {{ .NewEmail }}.",
      button: "Confirm new email →",
      href: confirmLink("email_change"),
      after: "If you didn't ask for this change, ignore this email and nothing will change.",
    }),
  },
  invite: {
    subject: "You're invited to SwiftCard",
    content: layout({
      heading: "You're invited to SwiftCard",
      intro: "You've been invited to create a SwiftCard account with {{ .Email }}. Tap the button below to accept.",
      button: "Accept the invitation →",
      href: confirmLink("invite"),
      after: "If you weren't expecting this, you can ignore this email.",
    }),
  },
};

/** The display name on every auth email (custom SMTP only). */
export const SENDER_NAME = "SwiftCard";
