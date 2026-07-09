import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { hasWalletConfig } from "@/lib/wallet-config";
import { isCardActive } from "@/lib/card-active";

// Signing needs Node (node-forge + fetch of assets) — never the edge runtime.
export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// GET /api/wallet/pass?card=<slug> → a signed .pkpass for that card.
// The card is public, so no auth: anyone viewing a card can add it to Wallet.
export async function GET(req: NextRequest) {
  if (!hasWalletConfig()) {
    return NextResponse.json(
      { error: "not_configured", message: "Apple Wallet isn't set up yet — add your Apple pass certificate to enable it." },
      { status: 501 }
    );
  }

  const username = req.nextUrl.searchParams.get("card");
  if (!username) return NextResponse.json({ error: "missing_card" }, { status: 400 });

  // Kill-switch: no passes for deleted accounts or plan-deactivated cards —
  // the pass is a durable artifact, so it must never be mintable for a card
  // whose links are dead. (Passes already in wallets point at the card URL,
  // which the same kill-switch 404s.)
  if (!(await isCardActive(username))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const admin = getAdminSupabase();
  const select = "username, name, title, company, phone, email, website";
  const { data: card } = await admin.from("cards").select(select).eq("username", username).maybeSingle();
  const src = card ?? (await admin.from("profiles").select(select).eq("username", username).maybeSingle()).data;
  if (!src) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    // Import the signer lazily so the (heavy) library only loads when actually used.
    const { buildPkpass } = await import("@/lib/wallet");
    const buf = await buildPkpass({
      username: src.username as string,
      name: (src.name as string) || "SwiftCard",
      title: src.title as string | null,
      company: src.company as string | null,
      phone: src.phone as string | null,
      email: src.email as string | null,
      website: src.website as string | null,
      cardUrl: `${APP_URL}/card/${src.username}`,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${src.username}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[wallet] pass build failed:", e);
    return NextResponse.json({ error: "build_failed" }, { status: 500 });
  }
}
