// Escape untrusted text before interpolating it into an HTML email/string.
// Several email builders interpolate visitor- or owner-supplied values (name,
// message, company…) straight into HTML. Without escaping, a value like
// "</p><a href=phish>Verify</a>" injects markup into a trusted-brand inbox.
export function escapeHtml(input: unknown): string {
  const s = input == null ? "" : String(input);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Safe value for an href/src attribute: only allow http(s), mailto, tel — never
// javascript:/data:. Returns "#" for anything suspicious. The result is also
// HTML-attribute-escaped so it can drop straight into href="...".
export function safeUrlAttr(input: unknown): string {
  const s = input == null ? "" : String(input).trim();
  if (/^(https?:|mailto:|tel:)/i.test(s) && !/[\s"'<>]/.test(s)) return escapeHtml(s);
  // Bare email/phone (no scheme) — callers usually wrap with mailto:/tel:.
  return "#";
}
