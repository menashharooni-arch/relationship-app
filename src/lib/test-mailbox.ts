// ── Addresses that can never receive mail ────────────────────────────────────
//
// The QA harness mints throwaway accounts at `*@swiftcard-test.invalid` (14
// scripts, nightly and after every deploy). `.invalid` is reserved by RFC 2606
// precisely so it never resolves — which means every message sent to one is a
// hard bounce recorded against swiftcard.me's sender reputation.
//
// Found in the 2026-09-23 analytics audit: 1,081 welcome rows in email_logs
// addressed to that domain, 1,008 of them with a Resend id, i.e. really handed
// over and really bounced. The welcome email had no idea the account was ours.
//
// This is the one predicate every sender should ask before calling Resend.
// It is deliberately narrow — the RFC 2606 reserved names plus our own QA
// domain — so a real customer on an unusual TLD is never silently skipped.
const RESERVED_TLDS = new Set(["invalid", "test", "example", "localhost"]);
export const QA_MAIL_DOMAIN = "swiftcard-test.invalid";

/** True for an address no message should ever be sent to. */
export function isTestMailbox(email: string | null | undefined): boolean {
  const at = (email ?? "").trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return false;
  const domain = (email as string).trim().toLowerCase().slice(at + 1);
  if (domain === QA_MAIL_DOMAIN) return true;
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  return RESERVED_TLDS.has(tld);
}
