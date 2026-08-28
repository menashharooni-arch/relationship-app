import { NextRequest, NextResponse } from "next/server";
import { hasWalletConfig } from "@/lib/wallet-config";

// Signing needs Node (node-forge + fetch of assets) — never the edge runtime.
export const runtime = "nodejs";

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

  try {
    // One builder, shared with the web service that serves updates — so the
    // pass a device re-downloads is byte-for-byte the pass the website hands
    // out. passInputs() also carries the kill-switches: a deleted account, an
    // offline office card or a card past its plan limit resolves to nothing,
    // and a pass must never be mintable for a card whose links are dead.
    const { buildPassDetailed, passInputs } = await import("@/lib/wallet-pass");
    const inputs = await passInputs(username);
    if (!inputs) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const { buf, degraded } = await buildPassDetailed(inputs);

    // Record the fingerprint on the way out. Without this the pass has no
    // baseline, and the first sweep after an add would count it as "changed"
    // and push a pointless update to a device that just downloaded it.
    try {
      const { touchWalletPass, markWalletPassStale } = await import("@/lib/wallet-registry");
      if (degraded) {
        // Served with initials where an image belongs: don't fingerprint it as
        // final — flag it so the next sweep re-pushes the real pass.
        console.warn("[wallet] degraded pass served (image fetch failed):", username);
        await markWalletPassStale(username);
      } else {
        await touchWalletPass(username);
      }
    } catch (e) {
      console.error("[wallet] fingerprint failed (pass still served):", e);
    }

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${username}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[wallet] pass build failed:", e);
    return NextResponse.json({ error: "build_failed" }, { status: 500 });
  }
}
