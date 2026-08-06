import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendWelcomeEmail } from "@/lib/welcome-email";

// POST /api/welcome — send this account's welcome email (once).
//
// The implementation moved to lib/welcome-email so onboarding can call it
// directly rather than self-fetching an HTTP route from a server component.
// Nothing called this route for its whole existence, which is why no signup
// ever received a welcome email; onboarding is now the real caller. This
// endpoint is kept as a thin, authenticated wrapper — it costs nothing, and a
// manual "resend my welcome" is a plausible support action.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await sendWelcomeEmail(user.id, user.email);
  if (result === "failed") return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ success: true, result });
}
