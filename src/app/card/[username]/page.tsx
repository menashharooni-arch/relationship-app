import { permanentRedirect } from "next/navigation";

// ── Legacy card URLs: /card/<username> → /<username> ────────────────────────
//
// 2026-08-19 (owner request): the canonical public card URL is the ROOT
// (swiftcard.me/<username>). This route exists so every /card/... link ever
// printed, written to an NFC tag, embedded in a Wallet pass, pasted into an
// email signature, or cached by a messenger keeps working forever.
//
// The QUERY STRING must survive the hop — sharing surfaces tag themselves
// (?source=qr_code, ?src=..., ?shared=1) and the analytics attribution lives
// there. next/navigation's redirect drops it, so it is re-attached by hand.
//
// The sibling opengraph-image.tsx is deliberately NOT a redirect: mail clients
// and unfurl caches hold direct /card/<u>/opengraph-image URLs, and those keep
// serving bytes from here.
export default async function LegacyCardRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v)) for (const item of v) q.append(k, item);
  }
  const qs = q.toString();
  permanentRedirect(`/${encodeURIComponent(username)}${qs ? `?${qs}` : ""}`);
}
