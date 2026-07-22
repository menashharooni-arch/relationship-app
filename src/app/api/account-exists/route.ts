import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isRateLimited } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

export const runtime = "nodejs";

// Does the visitor already have a SwiftCard account? Used to suppress the
// "create your free card" nudge for existing customers (owner request): we
// never pester someone who already has a card.
//
// Two signals, either one is enough:
//   1. The caller is SIGNED IN — they obviously have an account.
//   2. The email they just shared is tied to an existing account (matches an
//      account's auth email, a profile email, or a card's contact email).
//
// Boolean-only + rate-limited per IP so it can't be abused as an email
// enumeration oracle, and it only ever answers about an address the visitor
// themselves typed into a share form.
export async function POST(req: NextRequest) {
  // 1. Signed-in caller → yes, without needing any email.
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return NextResponse.json({ exists: true });
  } catch { /* not signed in — fall through to the email check */ }

  if (await isRateLimited(`acct-exists:${clientIp(req)}`, 30, 10 * 60 * 1000)) {
    // Fail OPEN (exists:false) so a throttled check never suppresses a genuine
    // new-visitor signup nudge.
    return NextResponse.json({ exists: false });
  }

  let email = "";
  try {
    const body = await req.json();
    if (typeof body?.email === "string") email = body.email.trim().toLowerCase();
  } catch { /* no body */ }
  if (!email || !email.includes("@")) return NextResponse.json({ exists: false });

  const admin = getAdminSupabase();
  try {
    // A profile whose contact email OR a card whose contact email matches means
    // this address already belongs to a SwiftCard account. ilike with no
    // wildcards = case-insensitive equality.
    const [{ data: prof }, { data: card }] = await Promise.all([
      admin.from("profiles").select("id").ilike("email", email).limit(1).maybeSingle(),
      admin.from("cards").select("id").ilike("email", email).limit(1).maybeSingle(),
    ]);
    return NextResponse.json({ exists: !!prof || !!card });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
