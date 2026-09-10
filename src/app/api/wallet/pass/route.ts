import { NextRequest, NextResponse } from "next/server";
import { hasWalletConfig } from "@/lib/wallet-config";
import { isRateLimited } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

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

  // Building a pass is the most expensive thing this app does per request: it
  // signs a bundle with node-forge and fetches the card's images first, and the
  // response is `no-store`, so nothing is absorbed by the CDN. The route is
  // public by design (anyone viewing a card can add it to Wallet), so it was an
  // unauthenticated, uncapped way to make the server do real work — fine at ten
  // users, not at thousands.
  //
  // THE NUMBER IS SET BY THE BOOTH, NOT BY THE ATTACKER. The product's best
  // moment is a conference stand where fifty people on ONE venue wifi each add
  // the same pass, so they share an IP. A tight cap would break exactly the
  // scenario this product exists for. 120 per IP per 10 minutes sits far above
  // the busiest realistic stand and still turns "unlimited" into 12/minute for
  // a script. If a real crowd ever trips it, raise it — do not tighten it.
  //
  // Deliberately NOT applied to the other two public endpoints an audit
  // flagged: card-signature is CDN-cached (s-maxage=300) so email image
  // proxies never reach the function, and an IP cap there would break embedded
  // signatures for everyone behind Gmail's proxy; the vCard is cheap and is
  // fetched once per visitor saving a contact — the same booth problem, with
  // none of the cost.
  if (await isRateLimited(`wallet-pass:${clientIp(req) ?? "anon"}`, 120, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

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
