import { escapeHtml } from "@/lib/escape";

// ── Office invite email ──────────────────────────────────────────────────────
// Pure builder: no IO, so tests assert the real bytes instead of grepping the
// route's source. It lives here rather than inline in the route because the
// invite is the ONLY mail SwiftCard sends to someone with no prior relationship
// to us — a stranger whose address a third party typed in — so it needs the
// bulk-class treatment (who sent it, why they got it, how to stop it) that a
// receipt or a password reset does not.
//
// Deliberately does NOT reuse layout() from email-templates.ts: that hardcodes
// SwiftCard's own header image and branding, which fights the whole point of a
// team invite looking like it came from the recipient's employer.

export type InviteEmail = { subject: string; html: string; fromName: string };

export function buildInviteEmail(opts: {
  ownerFirst: string;
  officeName: string;
  inviteeFirst?: string | null;
  inviteUrl: string;
  brandLogoUrl?: string | null;
  /** contactUnsubUrl(recipient), or null when the signing secret is unavailable. */
  unsubscribeUrl?: string | null;
}): InviteEmail {
  const owner = escapeHtml(opts.ownerFirst);
  const office = escapeHtml(opts.officeName);
  const first = opts.inviteeFirst ? escapeHtml(opts.inviteeFirst) : null;
  const logo = opts.brandLogoUrl ? escapeHtml(opts.brandLogoUrl) : null;
  // Printed as visible text so the recipient can see where the button goes
  // before clicking it — the thing that separates a legitimate invite from the
  // credential-harvest template that shares its shape.
  const host = (() => {
    try {
      return new URL(opts.inviteUrl).host;
    } catch {
      return "swiftcard.me";
    }
  })();

  const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
        ${logo
          ? `<img src="${logo}" width="56" height="56" alt="${office}" style="border-radius:10px;display:block;margin:0 0 20px;" />`
          : `<div style="margin:0 0 20px;"><span style="font-size:20px;font-weight:800;color:#111827;">${office}</span></div>`}
        <h2 style="font-size:22px;font-weight:700;color:#111;margin:0 0 10px;">${first ? `${first}, you're` : "You're"} invited</h2>
        <p style="color:#444;font-size:15px;line-height:1.5;margin:0 0 24px;">
          ${owner} added you to the <strong>${office}</strong> team on SwiftCard and invited you to create your company digital business card. It takes 2 minutes.
        </p>
        <a href="${opts.inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;text-decoration:none;padding:13px 30px;border-radius:100px;font-size:15px;">Create my card →</a>
        <p style="color:#999;font-size:12px;margin-top:14px;">This link goes to ${escapeHtml(host)}. The invite expires in 14 days.</p>
        <p style="color:#999;font-size:12px;margin-top:24px;">You received this because ${owner} entered your email address when adding you to ${office}. If you didn't expect it, you can ignore this email${opts.unsubscribeUrl ? " or unsubscribe below" : ""}.</p>
        <p style="color:#b6bcc6;font-size:11px;margin:0;line-height:1.6;">
          Sent by SwiftCard on behalf of ${office} · New York, NY${
            opts.unsubscribeUrl
              ? `<br><a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#b6bcc6;text-decoration:underline;">Unsubscribe from SwiftCard emails</a>`
              : ""}
        </p>
      </div>
    `;

  return {
    subject: `${opts.ownerFirst} invited you to create your ${opts.officeName} digital business card`,
    // Reconciles the From header with the body's claim and gives the recipient a
    // name they actually recognise. Previously the header said "SwiftCard" while
    // the body said "<Owner> invited you" — a stranger recognised neither.
    // Sanitized downstream by senderFrom(); never concatenate this yourself.
    fromName: `${opts.ownerFirst} (${opts.officeName})`,
    html,
  };
}
