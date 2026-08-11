import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isDownloadablePath, signDownloadToken } from "@/lib/download-token";

export const runtime = "nodejs";

/**
 * POST /api/download-token  { path } → { token }
 *
 * Called from INSIDE the app's webview, where the Supabase session cookie
 * lives, immediately before handing a download URL to the system browser —
 * which does not share that cookie (see lib/download-token.ts).
 *
 * Session-authenticated like any other route: the token it returns is only ever
 * a 60-second, path-scoped restatement of the session the caller already has,
 * so this grants nothing a plain fetch from the webview could not already do.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let path: unknown;
  try {
    ({ path } = await request.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Allowlist, not "whatever was asked for" — see DOWNLOADABLE_PATHS.
  if (typeof path !== "string" || !isDownloadablePath(path)) {
    return NextResponse.json({ error: "unsupported_path" }, { status: 400 });
  }

  return NextResponse.json({ token: signDownloadToken(user.id, path) });
}
