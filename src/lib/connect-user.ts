import { createClient } from "@/lib/supabase-server";
import { verifyState } from "@/lib/oauth-state";

/**
 * Who is starting an OAuth connect?
 *
 * On the web: the session cookie. In the iOS shell the connect leg runs in an
 * SFSafariViewController, whose cookie jar is isolated from the app's webview —
 * the session never arrives, and every OAuth connect (Salesforce, Google,
 * LinkedIn) opened a sign-in page instead. So the webview first POSTs
 * /api/integrations/handoff (cookie-authenticated) for a short-lived signed
 * token and appends it as ?h=; the connect route accepts that in place of the
 * session. The token is the same HMAC-signed user_id + timestamp the OAuth
 * `state` already uses (15-minute window, constant-time compare).
 */
export async function resolveConnectUserId(request: Request): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user.id;
  const h = new URL(request.url).searchParams.get("h");
  if (!h) return null;
  return verifyState(h);
}
