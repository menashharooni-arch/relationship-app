// Plain-text alternative for every email we send.
//
// WHY THIS EXISTS: an email with only an HTML part (no text/plain) is one of the
// strongest structural spam signals there is — Gmail, Outlook and Apple Mail all
// score HTML-only mail worse, because legitimate senders almost always ship a
// multipart/alternative message. Resend adds a `text` part whenever we pass one,
// so passing htmlToText(html) on EVERY send turns our mail multipart and lifts
// it out of the "looks like bulk/spam" bucket. It also makes the mail readable
// in text-only clients, watches, and screen readers.
//
// This is a pragmatic converter tuned for the block-ish HTML our templates emit
// (tables, <p>, <a>, headings) — not a full HTML parser. It keeps link targets
// visible ("Label (https://…)") so a text reader still gets the URLs.

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
  "&apos;": "'", "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…",
  "&rarr;": "→", "&larr;": "←", "&check;": "✓",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&[a-zA-Z#0-9]+;/g, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

export function htmlToText(html: string): string {
  let s = html;

  // Drop everything that never renders as reading text.
  s = s.replace(/<!DOCTYPE[^>]*>/gi, "");
  s = s.replace(/<head[\s\S]*?<\/head>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  // Links → "label (href)", so URLs survive in text-only clients.
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    const text = label.replace(/<[^>]+>/g, "").trim();
    const url = String(href).trim();
    if (!url || url.startsWith("mailto:")) return text || url.replace(/^mailto:/, "");
    // Skip the "(url)" suffix when the label already IS the url.
    return text && text !== url ? `${text} (${url})` : url;
  });

  // Block-level boundaries → newlines (before stripping tags).
  s = s.replace(/<(br|hr)\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|tr|h1|h2|h3|h4|li|table|blockquote)>/gi, "\n");
  s = s.replace(/<li[^>]*>/gi, "• ");

  // Strip all remaining tags, decode entities.
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);

  // Tidy whitespace: trim each line, collapse runs of blank lines, cap length.
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}
