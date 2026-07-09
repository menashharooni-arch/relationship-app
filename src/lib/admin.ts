import { createClient } from "@/lib/supabase-server";

// Admin access is gated by ADMIN_EMAILS (comma-separated env var) — the same
// gate used across every /admin page and /api/admin route.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// For API routes: returns the admin user, or null (caller responds 403).
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
