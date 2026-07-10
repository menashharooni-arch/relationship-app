import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getLogoProvider } from "@/lib/logo-provider";

// Provider calls need Node (safeFetch uses undici + node:dns) — never edge.
export const runtime = "nodejs";

// POST /api/logo-suggest  { input: "<company name | business email | domain>" }
// → { status, candidates: [{ name, domain, logoUrl }] }
//
// Auth-gated: only a signed-in user can spend our provider quota. The response
// NEVER auto-applies a logo — it only offers candidates the client must confirm.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const provider = getLogoProvider();
  // Fail safe: if no credential is configured the feature is off. Return a
  // clean disabled state (200) rather than an error so the client just hides.
  if (!provider.isConfigured()) {
    return NextResponse.json({ status: "not_configured", candidates: [] });
  }

  let input = "";
  try {
    const body = await req.json();
    if (typeof body?.input === "string") input = body.input;
  } catch {
    return NextResponse.json({ status: "invalid_input", candidates: [] });
  }

  const result = await provider.suggest(input);
  return NextResponse.json(result);
}
