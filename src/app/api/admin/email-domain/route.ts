import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureDomain, verifyDomain } from "@/lib/resend-domain";

// Email sending domain (Resend) for the Marketing page: GET returns current
// status + the DNS records to add (creating the domain on first call);
// POST {action:"verify"} asks Resend to re-check DNS now.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await ensureDomain());
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== "verify") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return NextResponse.json(await verifyDomain());
}
