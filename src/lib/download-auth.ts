import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyDownloadToken, type DownloadablePath } from "@/lib/download-token";

/**
 * Who is asking for this file — by session, or by a signed `?dl=` token.
 *
 * The token path exists because the iOS shell hands downloads to the SYSTEM
 * browser, which does not carry the webview's Supabase session cookie. See
 * lib/download-token.ts for the full story.
 *
 * `path` is passed by the ROUTE, never read from the request, so a token minted
 * for one endpoint cannot be spent at another.
 *
 * A `dl` that is present but invalid REFUSES rather than falling through to the
 * session. In the browser sheet there is no session to fall through to, so a
 * fallback could only ever mask an expired or tampered token as a different
 * error — and silently accepting requests with a bad signature attached is the
 * wrong instinct to encode.
 */
export async function resolveDownloadUserId(
  req: NextRequest,
  path: DownloadablePath,
): Promise<string | null> {
  const token = req.nextUrl.searchParams.get("dl");
  if (token) return verifyDownloadToken(token, path);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
