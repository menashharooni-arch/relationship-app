import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendWelcomeWhenCardLive } from "@/lib/welcome-email";

// POST /api/welcome — send this account's welcome email (once).
//
// The implementation lives in lib/welcome-email so the card-creation paths can
// call it directly rather than self-fetching an HTTP route from a server
// component. Nothing called this route for its whole existence, which is why no
// signup ever received a welcome email. It is kept as a thin, authenticated
// wrapper — a manual "resend my welcome" is a plausible support action.
//
// It goes through the CARD-GATED entry point like everything else: the email is
// titled "Your SwiftCard is live", so there is exactly one rule about when it
// may be sent, and no back door that can promise a card the account has not
// built (owner, 2026-09-11). An account with no card gets "skipped".
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await sendWelcomeWhenCardLive(user.id, user.email);
  if (result === "failed") return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ success: true, result });
}
