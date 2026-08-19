// The card's link-preview image, served at the canonical root URL
// (/<username>/opengraph-image). The RENDERER is shared with
// app/card/[username]/opengraph-image.tsx so LEGACY /card/<username> URLs —
// printed QR codes, sent emails, cached unfurls — keep serving the image
// directly with no redirect hop. The route-segment config below must be
// literal (Next statically analyzes it and refuses re-exports) and must stay
// byte-identical to the legacy route's.
export { default } from "../card/[username]/opengraph-image";

export const size = { width: 1200, height: 686 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
