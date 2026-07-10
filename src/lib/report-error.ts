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

  // (b) Real-time chat alert — only if a webhook is configured. Short-timeout,
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
