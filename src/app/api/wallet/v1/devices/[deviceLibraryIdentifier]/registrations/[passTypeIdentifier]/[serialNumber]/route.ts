import { NextRequest, NextResponse } from "next/server";
import { registerDevice, unregisterDevice, verifyPassAuth } from "@/lib/wallet-registry";

// Apple's register/unregister endpoint:
//   POST   /v1/devices/{device}/registrations/{passType}/{serial}   {pushToken}
//   DELETE /v1/devices/{device}/registrations/{passType}/{serial}
//
// Called by iOS itself, not by our app — there is no session here. The only
// credential is the pass's own authenticationToken, sent as
// `Authorization: ApplePass <token>`.

export const runtime = "nodejs";

type Params = { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string }> };

/** Reject a request aimed at some other pass type outright. */
function wrongPassType(passTypeIdentifier: string): boolean {
  const ours = process.env.APPLE_PASS_TYPE_ID;
  return !ours || passTypeIdentifier !== ours;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = await params;
  if (wrongPassType(passTypeIdentifier)) return new NextResponse(null, { status: 404 });
  if (!verifyPassAuth(req.headers.get("authorization"), serialNumber)) {
    return new NextResponse(null, { status: 401 });
  }

  let pushToken = "";
  try {
    pushToken = String(((await req.json()) as { pushToken?: unknown }).pushToken ?? "").trim();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  // Without a token the registration is inert — it would sit in the table
  // looking registered while no push could ever reach the device.
  if (!pushToken) return new NextResponse(null, { status: 400 });

  try {
    const result = await registerDevice(deviceLibraryIdentifier, serialNumber, pushToken);
    return new NextResponse(null, { status: result === "created" ? 201 : 200 });
  } catch (e) {
    console.error("[wallet] register failed:", e);
    return new NextResponse(null, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = await params;
  if (wrongPassType(passTypeIdentifier)) return new NextResponse(null, { status: 404 });
  if (!verifyPassAuth(req.headers.get("authorization"), serialNumber)) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    await unregisterDevice(deviceLibraryIdentifier, serialNumber);
    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error("[wallet] unregister failed:", e);
    return new NextResponse(null, { status: 500 });
  }
}
