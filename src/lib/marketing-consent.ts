import { getAdminSupabase } from "@/lib/supabase-admin";

// ── May we send this person this marketing email? ────────────────────────────
//
// ONE gate in front of every marketing send. Transactional mail — auth, password
// resets, lead notifications, billing, receipts — never comes through here and
// is never suppressed by a preference: a receipt is not marketing, and
// withholding one because somebody unsubscribed from tips would be a worse
// failure than sending it.
//
// Three ways to be suppressed, checked in this order:
//   1. marketing_opt_out (or the legacy marketing_emails=false) — a full stop.
//   2. paused_until in the future — a 30-day snooze the person asked for.
//   3. the category flag for THIS email being false.
//
// FAIL CLOSED. If the preferences row cannot be read, we do not send. The
// alternative is mailing someone whose opt-out we could not confirm, and the
// cost of that (a spam complaint, and a CAN-SPAM violation if they had opted
// out) is far higher than the cost of a marketing email nobody receives.

export type MarketingCategory = "lead_tips" | "product_updates" | "digest" | "promotions";

export const MARKETING_CATEGORIES: MarketingCategory[] = [
  "lead_tips",
  "product_updates",
  "digest",
  "promotions",
];

export type EmailPreferences = {
  user_id: string;
  lead_tips: boolean;
  product_updates: boolean;
  digest: boolean;
  digest_frequency: "weekly" | "monthly";
  promotions: boolean;
  paused_until: string | null;
  marketing_opt_out: boolean;
  /** Legacy switch still read by older send paths — kept in lockstep. */
  marketing_emails: boolean;
  receipt_emails: boolean;
};

/** What a brand-new account gets: everything on. */
export const DEFAULT_PREFERENCES: Omit<EmailPreferences, "user_id"> = {
  lead_tips: true,
  product_updates: true,
  digest: true,
  digest_frequency: "weekly",
  promotions: true,
  paused_until: null,
  marketing_opt_out: false,
  marketing_emails: true,
  receipt_emails: true,
};

const COLUMNS =
  "user_id, lead_tips, product_updates, digest, digest_frequency, promotions, paused_until, marketing_opt_out, marketing_emails, receipt_emails";

/**
 * The row, or null when it cannot be read.
 *
 * A MISSING row is not a failure — it means nobody has touched their settings,
 * which is consent by default. It resolves to DEFAULT_PREFERENCES. A database
 * error is a different thing entirely and returns null, which suppresses.
 */
export async function readPreferences(userId: string): Promise<EmailPreferences | null> {
  if (!userId) return null;
  try {
    const { data, error } = await getAdminSupabase()
      .from("email_preferences")
      .select(COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    // 42703 = a column that predates the migration. Treat exactly like a
    // missing row (defaults) rather than suppressing every marketing email in
    // the product until someone runs the SQL.
    if (error) {
      if ((error as { code?: string }).code === "42703") return { user_id: userId, ...DEFAULT_PREFERENCES };
      return null;
    }
    if (!data) return { user_id: userId, ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...(data as Partial<EmailPreferences>), user_id: userId };
  } catch {
    return null;
  }
}

/**
 * Is this account inside a self-requested pause?
 *
 * Lives here rather than in the page so the clock is read in a module, not
 * during a component render — React's purity rule flags the latter, and it is
 * right to: a value that changes between two renders of the same props is
 * exactly what breaks hydration.
 */
export function isPaused(prefs: EmailPreferences | null, now: number = Date.now()): boolean {
  return !!prefs?.paused_until && Date.parse(prefs.paused_until) > now;
}

/** Pure decision, so the whole matrix is testable without a database. */
export function allowsMarketing(
  prefs: EmailPreferences | null,
  category: MarketingCategory,
  now: number = Date.now(),
): boolean {
  if (!prefs) return false;                                   // unreadable → do not send
  if (prefs.marketing_opt_out) return false;                  // full opt-out
  if (prefs.marketing_emails === false) return false;         // legacy full opt-out
  if (prefs.paused_until && Date.parse(prefs.paused_until) > now) return false;
  return prefs[category] !== false;
}

/**
 * THE check every marketing send must make.
 *
 * @example
 *   if (!(await canSendMarketing(userId, "promotions"))) continue;
 */
export async function canSendMarketing(userId: string, category: MarketingCategory): Promise<boolean> {
  return allowsMarketing(await readPreferences(userId), category);
}

/**
 * Bulk form for campaign loops — one query instead of N.
 *
 * Returns the set of user ids that MAY receive this category. Ids whose row
 * could not be read are absent from the set, so the caller's `has()` test
 * suppresses them, matching canSendMarketing's fail-closed rule.
 */
export async function marketingAudience(
  userIds: string[],
  category: MarketingCategory,
  now: number = Date.now(),
): Promise<Set<string>> {
  const allowed = new Set<string>();
  const wanted = Array.from(new Set(userIds.filter(Boolean)));
  if (!wanted.length) return allowed;

  const admin = getAdminSupabase();
  for (let i = 0; i < wanted.length; i += 500) {
    const chunk = wanted.slice(i, i + 500);
    try {
      const { data, error } = await admin.from("email_preferences").select(COLUMNS).in("user_id", chunk);
      if (error) {
        // Pre-migration column set: fall back to defaults for this chunk rather
        // than silently dropping an entire campaign.
        if ((error as { code?: string }).code === "42703") {
          for (const id of chunk) allowed.add(id);
        }
        continue;
      }
      const seen = new Map<string, EmailPreferences>();
      for (const row of (data ?? []) as Partial<EmailPreferences>[]) {
        if (row.user_id) seen.set(row.user_id, { ...DEFAULT_PREFERENCES, ...row, user_id: row.user_id });
      }
      for (const id of chunk) {
        // No row = never touched their settings = consent by default.
        const prefs = seen.get(id) ?? { user_id: id, ...DEFAULT_PREFERENCES };
        if (allowsMarketing(prefs, category, now)) allowed.add(id);
      }
    } catch {
      /* chunk unreadable → nobody in it is added → nobody in it is mailed */
    }
  }
  return allowed;
}

/**
 * Record an opt-out and make it effective everywhere at once.
 *
 * Both flags are written because older send paths read only the legacy one; an
 * opt-out that lands in one column is an opt-out we would keep failing to
 * honour. Returns false when nothing was written, so a caller never tells a
 * person (or Gmail) that it worked when it did not.
 */
export async function recordOptOut(opts: {
  userId: string;
  source: "footer" | "one_click_header";
  reason?: string | null;
}): Promise<boolean> {
  const admin = getAdminSupabase();
  try {
    const { data, error } = await admin
      .from("email_preferences")
      .upsert(
        {
          user_id: opts.userId,
          marketing_opt_out: true,
          marketing_emails: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("user_id");
    if (error || !data?.length) return false;
  } catch {
    return false;
  }

  // The audit row is best-effort ON PURPOSE: the suppression above is what
  // stops the mail, and failing the whole request because a log insert failed
  // would turn a working unsubscribe into a broken one.
  try {
    await admin.from("unsubscribe_events").insert({
      user_id: opts.userId,
      source: opts.source,
      reason: opts.reason ?? null,
    });
  } catch { /* logging must never break an opt-out */ }

  return true;
}
