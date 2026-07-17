import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isRateLimited } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { isValidSignupInvite, normalizeInviteCode, INVITE_COOKIE } from "@/lib/signup-invite";

// Public, unauthenticated: the signup form calls this before creating an
// account. On a valid code it sets a short-lived httpOnly cookie that
// /onboarding re-verifies before provisioning. Rate-limited per IP so the
// code list can't be brute-forced.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (await isRateLimited(`invite-verify:${ip}`, 15, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const code = normalizeInviteCode((body as { code?: unknown }).code);
  if (!code || !(await isValidSignupInvite(code))) {
    return NextResponse.json({ ok: false, error: "That invite code isn't valid." }, { status: 400 });
  }

  const jar = await cookies();
  jar.set(INVITE_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour — long enough to finish signup, short enough not to linger
  });
  return NextResponse.json({ ok: true });
}
