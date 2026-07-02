import { NextRequest, NextResponse } from "next/server";
import { ensureDomain } from "@/lib/resend-domain";

// TEMPORARY: creates the swiftcard.me sending domain in Resend and returns the
// DNS records to add. Token-guarded; removed immediately after verification.
const TOKEN = "xW3nB8qJt5KvY7zR2mC9dF4hL6sP1aGu";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(await ensureDomain());
}
