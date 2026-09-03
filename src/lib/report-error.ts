// ── Central error reporter ──────────────────────────────────────────────────
// Every unexpected failure in a critical path (billing webhook, cron, CRM sync)
// should flow through here so it's both (a) greppable in Vercel logs as
// structured JSON and (b) optionally pushed to a chat webhook for real-time
// alerts. This is intentionally dependency-free — no SDK to fight Next's build.
//
// Set ALERT_WEBHOOK_URL to a Slack or Discord *incoming webhook* URL to get
// pinged when something breaks. Without it, errors are still structured-logged.
//
// Never throws: reporting an error must not itself break the path that failed.

const ALERT_URL = process.env.ALERT_WEBHOOK_URL;
const APP_ENV = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";

/**
 * Stable grouping key for "the same bug". Numbers, uuids, and quoted values are
 * stripped so `card 41 not found` and `card 92 not found` group together —
 * otherwise every occurrence looks like a brand-new incident and the watchdog's
 * dedupe cannot hold.
 */
function fingerprintOf(context: string, message: string): string {
  const shape = message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/["'`][^"'`]{0,80}["'`]/g, "<v>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return `${context}|${shape}`;
}

export async function reportError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  const payload = {
    level: "error",
    context,
    message: err.message,
    stack: err.stack,
    env: APP_ENV,
    ...(extra ? { extra } : {}),
  };

  // (a) Structured log — always. Vercel captures stderr; log drains can alert on it.
  try {
    console.error(`[error] ${JSON.stringify(payload)}`);
  } catch {
    console.error("[error]", context, err.message);
  }

  // (b) Durable row — so something can READ this back. The console line above
  // is ephemeral and needs a Vercel token to reach; this is what lets Bo watch
  // for crashes with the Supabase key the agents already hold. Fire-and-forget
  // and fully swallowed: if the table is missing (migration not yet applied) or
  // Supabase is down, the path that failed must not fail twice.
  try {
    const { getAdminSupabase } = await import("@/lib/supabase-admin");
    await getAdminSupabase().from("error_events").insert({
      context,
      message: err.message.slice(0, 2000),
      stack: err.stack?.slice(0, 8000) ?? null,
      env: APP_ENV,
      fingerprint: fingerprintOf(context, err.message),
      ...(extra ? { extra } : {}),
    });
  } catch {
    /* durable sink is best-effort — the structured log above is the fallback */
  }

  // (c) Real-time chat alert — only if a webhook is configured. Short-timeout,
  // best-effort; a down webhook must never delay or break the caller.
  if (ALERT_URL) {
    const text = `🚨 *SwiftCard error* [${APP_ENV}] — *${context}*\n${err.message}`;
    try {
      await fetch(ALERT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `text` works for Slack, `content` for Discord — sending both is
        // harmless (each ignores the key it doesn't use).
        body: JSON.stringify({ text, content: text }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      /* alerting is best-effort — the structured log above is the source of truth */
    }
  }
}
