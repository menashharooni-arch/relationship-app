import { Resend } from "resend";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { welcomeEmail, unsubUrl, marketingHeaders } from "@/lib/email-templates";
import { ensureEmailPreferences } from "@/lib/email-prefs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// ── Welcome email ────────────────────────────────────────────────────────────
//
// This logic lived only inside POST /api/welcome, and nothing ever called that
// route — not the app, not a cron, not a server action. (The /welcome PAGE is
// a different thing entirely.) So no signup has ever received a welcome email,
// and the template, the idempotency claim and its unique index were all dead
// code that looked alive.
//
// Extracted here so onboarding can call it directly instead of self-fetching
// its own HTTP route from a server component. The route still exists and now
// delegates to this, so any future caller behaves identically.

export type WelcomeResult = "sent" | "already_sent" | "skipped" | "failed";

/**
 * Send the welcome email once per account. Safe to call concurrently: the
 * email_logs insert is the atomic gate (a partial unique index on user_id
 * WHERE type='welcome'), so of two racing signup submissions exactly one
 * sends and the loser returns "already_sent".
 *
 * Never throws — a welcome email must not be able to fail a signup.
 */
export async function sendWelcomeEmail(userId: string, accountEmail: string | null | undefined): Promise<WelcomeResult> {
  if (!userId || !accountEmail) return "skipped";
  try {
    const admin = getAdminSupabase();

    const { data: profile } = await admin
      .from("profiles")
      .select("name, username")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return "skipped";

    // Cheap pre-check. The insert below is the real gate; this just avoids
    // building a template and burning an insert attempt on the common path.
    const { data: alreadySent } = await admin
      .from("email_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "welcome")
      .maybeSingle();
    if (alreadySent) return "already_sent";

    await ensureEmailPreferences(userId, admin);
    const { data: prefsRow } = await admin
      .from("email_preferences")
      .select("unsubscribe_token")
      .eq("user_id", userId)
      .maybeSingle();

    const unsub = unsubUrl(prefsRow?.unsubscribe_token as string | undefined ?? "");
    const template = welcomeEmail({
      firstName: (profile.name as string | null)?.split(" ")[0] || "there",
      cardUrl: `${APP_URL}/card/${profile.username}`,
      unsubscribeUrl: unsub,
    });

    // CLAIM before sending. The check above is a check-then-act that two
    // concurrent requests can both pass; this insert is what actually
    // serializes them.
    const { error: claimError } = await admin.from("email_logs").insert({
      user_id: userId,
      email: accountEmail,
      type: "welcome",
      subject: template.subject,
    });
    if (claimError) return "already_sent";

    const resend = new Resend(process.env.RESEND_API_KEY);
    // Resend RESOLVES {data, error} rather than throwing, so the error must be
    // read off the result — a .catch() here would never fire on an API-level
    // failure and the claim would stick, costing this user their welcome
    // email permanently.
    const { data: sent, error: sendError } = await resend.emails.send({
      ...template,
      to: accountEmail,
      // One-click unsubscribe headers, only when there is a token to resolve.
      ...(unsub ? { headers: marketingHeaders(unsub) } : {}),
    });

    if (sendError) {
      // Release the claim so a retry can still deliver it.
      await admin.from("email_logs").delete().eq("user_id", userId).eq("type", "welcome");
      console.error("[welcome] send failed:", sendError.message);
      return "failed";
    }

    if (sent?.id) {
      await admin.from("email_logs").update({ resend_id: sent.id }).eq("user_id", userId).eq("type", "welcome");
    }
    return "sent";
  } catch (e) {
    console.error("[welcome] unexpected error:", e instanceof Error ? e.message : e);
    return "failed";
  }
}
