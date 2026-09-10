import { createClient } from "@/lib/supabase-server";
import { verifyConnectHandoff } from "@/lib/oauth-state";

/**
 * Who is starting an OAuth connect?
 *
 * On the web: the session cookie. In the iOS shell the connect leg runs in an
 * SFSafariViewController, whose cookie jar is isolated from the app's webview —
 * the session never arrives, and every OAuth connect (Salesforce, Google,
 * LinkedIn) opened a sign-in page instead. So the webview first POSTs
 * /api/integrations/handoff (cookie-authenticated) for a short-lived signed
 * token and appends it as ?h=; the connect route accepts that in place of the
 * session.
 *
 * That token is a CREDENTIAL — presenting it starts a connect as that user —
 * so it is deliberately NOT the OAuth `state`, which it used to be. `state`
 * travels in a query string to Google or Salesforce and therefore lands in
 * browser history, provider logs and referrers; it is not a secret. Anyone
 * holding one inside its 15-minute window could have called this route as its
 * owner, completed consent with their OWN account, and had their tokens
 * written onto the victim's integrations row — every future lead syncing to
 * the attacker. signConnectHandoff domain-separates the two so neither can be
 * presented as the other, on a 5-minute window.
 */
export async function resolveConnectUserId(request: Request): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user.id;
  const h = new URL(request.url).searchParams.get("h");
  if (!h) return null;
  return verifyConnectHandoff(h);
}
