import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isInviteExpired } from "@/lib/office-invite";
import { isRateLimited } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { sendRawEmail } from "@/lib/messaging";
import { buildJoinSignInEmail } from "@/lib/office-invite-email";
import { getOfficeBrand } from "@/lib/office-brand";
import { officeCompanyName } from "@/lib/office-display-name";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// POST /api/join/sign-in-link { token } — "Email me a sign-in link" on /join.
//
// Replaces the browser's own supabase.auth.signInWithOtp, for two reasons:
//  • The email was Supabase's stock template: no SwiftCard, no company, no word
//    about the invite. We send our own, branded like the invite.
//  • Its link was PKCE, so it signed in only in the browser that asked for it —
//    open it on a phone, in Gmail's in-app browser, or in Safari after asking in
//    Chrome, and it failed. This link carries a token hash that /auth/confirm
//    verifies on the server, so it works wherever it is opened.
//
// SECURITY: the link only ever goes to the address the invite was SENT to,
// read from the invite row — the request carries nothing but the token. It is
// never returned in the response.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!/^[A-Za-z0-9-]{8,100}$/.test(token)) {
    return NextResponse.json({ error: "That invite link isn't valid." }, { status: 400 });
  }

  // Each send is an email to a real inbox: cap per invite and per IP.
  const ip = clientIpFromHeaders(req.headers);
  if (
    (await isRateLimited(`join-link:${token}`, 5, 15 * 60 * 1000)) ||
    (await isRateLimited(`join-link-ip:${ip}`, 20, 60 * 60 * 1000))
  ) {
    return NextResponse.json(
      { error: "Too many sign-in links were sent. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const admin = getAdminSupabase();
  const { data: invite } = await admin
    .from("office_members")
    .select("status, invite_email, expires_at, invited_at, office_id, offices(name, owner_id, brand_company)")
    .eq("invite_token", token)
    .maybeSingle();

  const office = invite?.offices as unknown as { name?: string; owner_id?: string; brand_company?: string } | null;
  const email = (invite?.invite_email as string | null)?.trim().toLowerCase() ?? "";
  // Same states /join and /api/join refuse — never mint a sign-in for an
  // invite that can no longer be accepted.
  let usable = !!invite && invite.status === "pending" && !!email
    && !isInviteExpired(invite as { status?: string; expires_at?: string | null; invited_at?: string | null });
  if (usable && office?.owner_id) {
    const { data: owner } = await admin.from("profiles").select("plan").eq("id", office.owner_id).maybeSingle();
    usable = owner?.plan === "enterprise";
  }
  if (!usable) {
    return NextResponse.json(
      { error: "This invite can't be used any more. Ask your team admin to send a new one." },
      { status: 410 },
    );
  }

  // magiclink: signs in an existing account; for an address with no account
  // yet, Supabase creates it and returns a signup-type link (verification_type)
  // — the same account signInWithOtp({ shouldCreateUser: true }) used to make.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = link?.properties?.hashed_token;
  const vType = link?.properties?.verification_type;
  if (linkError || !hashed || (vType !== "magiclink" && vType !== "signup")) {
    console.error("[join/sign-in-link] generateLink failed:", linkError?.message ?? "no hashed token");
    return NextResponse.json({ error: "Couldn't create a sign-in link. Please try again." }, { status: 500 });
  }

  const next = `/join/${token}`;
  const signInUrl =
    `${APP_URL}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=${vType}&next=${encodeURIComponent(next)}`;

  const [officeName, brand] = await Promise.all([
    officeCompanyName(invite!.office_id as string, {
      brandCompany: office?.brand_company ?? null,
      storedName: office?.name ?? null,
      ownerId: office?.owner_id ?? null,
    }),
    getOfficeBrand(invite!.office_id as string).catch(() => null),
  ]);
  const mail = buildJoinSignInEmail({ officeName, brandLogoUrl: brand?.logoUrl ?? null, signInUrl, inviteEmail: email });

  const result = await sendRawEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    fromName: mail.fromName,
    sender: "support",
    // An account email the person just asked for, one at a time: transactional,
    // no List-Unsubscribe (an unsubscribe here would only block their sign-in).
    personal: true,
  });
  if (result !== "sent") {
    return NextResponse.json({ error: "Couldn't send the email. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
