import { NextRequest, NextResponse } from "next/server";
import { serialsForDevice } from "@/lib/wallet-registry";

// "Which of my passes changed?"
//   GET /v1/devices/{device}/registrations/{passType}?passesUpdatedSince=<tag>
//
// The device asks this after a push, and again whenever it feels like it.
// Deliberately UNAUTHENTICATED — there is no per-pass token to present when
// the question spans every pass on the device, and Apple's protocol doesn't
// send one. The device library identifier is an opaque per-device value that
// only that device knows, and the answer is a list of card slugs which are
// public anyway; the pass itself still requires its token to download.

export const runtime = "nodejs";

type Params = { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { deviceLibraryIdentifier, passTypeIdentifier } = await params;
  const ours = process.env.APPLE_PASS_TYPE_ID;
  if (!ours || passTypeIdentifier !== ours) return new NextResponse(null, { status: 404 });

  try {
    const since = req.nextUrl.searchParams.get("passesUpdatedSince");
    const { serialNumbers, lastUpdated } = await serialsForDevice(deviceLibraryIdentifier, since);

    // 204, not an empty list: Apple treats a body with no serials as a
    // protocol error, and a device that gets one stops asking.
    if (!serialNumbers.length) return new NextResponse(null, { status: 204 });

    return NextResponse.json({ serialNumbers, lastUpdated }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[wallet] serial list failed:", e);
    return new NextResponse(null, { status: 500 });
  }
}
