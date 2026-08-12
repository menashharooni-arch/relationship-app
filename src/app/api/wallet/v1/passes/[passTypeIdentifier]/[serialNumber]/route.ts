import { NextRequest, NextResponse } from "next/server";
import { hasWalletConfig } from "@/lib/wallet-config";
import { passUpdatedAt, verifyPassAuth } from "@/lib/wallet-registry";
import { buildPass, passInputs } from "@/lib/wallet-pass";

// "Give me the current version of this pass."
//   GET /v1/passes/{passType}/{serial}
//
// The last step of an update: the device has been pushed, has asked which
// serials changed, and now collects each one. Same builder as the Add to
// Wallet download, so what arrives here is byte-for-byte what the website
// would hand out today.

export const runtime = "nodejs";

type Params = { params: Promise<{ passTypeIdentifier: string; serialNumber: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { passTypeIdentifier, serialNumber } = await params;
  const ours = process.env.APPLE_PASS_TYPE_ID;
  if (!hasWalletConfig() || !ours || passTypeIdentifier !== ours) {
    return new NextResponse(null, { status: 404 });
  }
  if (!verifyPassAuth(req.headers.get("authorization"), serialNumber)) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    const updatedAt = await passUpdatedAt(serialNumber);

    // If-Modified-Since is second-resolution, so a pass updated within the
    // same second as the device's copy compares equal. Rebuilding and
    // re-sending in that case is harmless; claiming 304 when the content moved
    // is not — the device would keep a stale pass indefinitely.
    const since = req.headers.get("if-modified-since");
    if (updatedAt && since) {
      const sinceMs = Date.parse(since);
      if (Number.isFinite(sinceMs) && Math.floor(updatedAt.getTime() / 1000) * 1000 <= sinceMs) {
        return new NextResponse(null, { status: 304 });
      }
    }

    const inputs = await passInputs(serialNumber);
    // Deleted, taken offline, or past its plan limit. 404 is what tells the
    // device to stop asking; the pass in the wallet stops updating and its
    // card URL 404s too.
    if (!inputs) return new NextResponse(null, { status: 404 });

    const buf = await buildPass(inputs);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": (updatedAt ?? new Date()).toUTCString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[wallet] latest pass failed:", e);
    return new NextResponse(null, { status: 500 });
  }
}
