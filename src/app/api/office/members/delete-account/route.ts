import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireOfficeCapability } from "@/lib/office-roles";
import { isRateLimited } from "@/lib/rate-limit";
import { stopSubscription } from "@/lib/account-purge";
import { reportError } from "@/lib/report-error";
import { revokeAppleTokensOnDelete } from "@/lib/apple-revoke";
import { writeAudit } from "@/lib/audit";
import { sendRawEmail } from "@/lib/messaging";
import { escapeHtml } from "@/lib/escape";
import { DELETE as removeFromTeam } from "../route";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// POST ?id=<office_members row id> — the office OWNER deletes a team member's
// SwiftCard account (owner decision, 2026-09-23: members cannot delete their
// own account; only the admin of the Office plan can).
//
// Both halves are existing behaviour:
//   • "Remove from team" — the SAME handler the Remove button calls, so the
//     seat is freed, the leads they captured stay with the company, the
//     company branding comes off their cards and the membership row goes.
//     Called, not copied, so the two can never drift.
//   • The account's own soft delete — the same steps as a self-delete
//     (api/account/delete): any personal subscription stopped, plan to Free,
//     `_deleted` set (everything hidden at once, the 30-day reopen window,
//     then the daily purge removes it for good), Apple tokens revoked.
// The ORDER they run in is explained at the steps below.
//
// Owner only — not a delegated admin: this deletes someone's whole account,
// not just their seat. The person is emailed, because they can no longer see
// anything in the app, and signing in within 30 days offers to reopen it.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await isRateLimited(`office-member-delete:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests — please wait a moment and try again." }, { status: 429 });
  }

  const ctx = await requireOfficeCapability(user.id, "remove_members");
  if (!ctx || !ctx.isOwner) {
    return NextResponse.json({ error: "Only the Office owner can delete a team member's account." }, { status: 403 });
  }

  const memberId = new URL(req.url).searchParams.get("id");
  if (!memberId) return NextResponse.json({ error: "Member ID required" }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: member } = await admin
    .from("office_members")
    .select("user_id, status")
    .eq("id", memberId)
    .eq("office_id", ctx.officeId)
    .maybeSingle();
  if (!member?.user_id || member.status !== "active") {
    return NextResponse.json({ error: "That person isn't an active member of your team." }, { status: 404 });
  }
  const targetId = member.user_id as string;
  if (targetId === user.id || targetId === ctx.ownerId) {
    return NextResponse.json({ error: "You can't delete your own account from here." }, { status: 400 });
  }

  const [{ data: profile }, { data: authData }] = await Promise.all([
    admin.from("profiles").select("plan, stripe_subscription_id, customization").eq("id", targetId).maybeSingle(),
    admin.auth.admin.getUserById(targetId),
  ]);
  if (!profile) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const target = authData?.user ?? null;

  // ORDER MATTERS, measured live (2026-09-23): run as "remove, then delete",
  // an interrupted request (the admin closing the tab mid-way) left someone
  // removed but NOT deleted — and no longer on the team, so the admin could
  // never press Delete again. Now:
  //   1. mark the account deleted (fast; the person is blocked at once);
  //   2. remove them from the team — the Remove button's own handler;
  //   3. assert the deleted state again (removal rewrites plan/customization);
  //   4. the slow, outside parts (Stripe, Apple, the email) in after(), which
  //      the platform runs to completion even if the admin has gone.
  // Interrupted after 1, they are still on the team and Delete can be pressed
  // again; everything below is safe to repeat.
  const deletion = {
    reason: "deleted_by_office_owner",
    comment: "",
    plan: profile.plan,
    at: new Date().toISOString(),
    by: user.id,
    officeId: ctx.officeId,
  };
  const markDeleted = async () => {
    const { data: fresh } = await admin.from("profiles").select("customization").eq("id", targetId).maybeSingle();
    const cust = (fresh?.customization as Record<string, unknown> | null) ?? {};
    return admin
      .from("profiles")
      .update({ plan: "free", customization: { ...cust, _deleted: true, _deletion: (cust._deletion as object | undefined) ?? deletion } })
      .eq("id", targetId);
  };
  const first = await markDeleted();
  if (first.error) {
    await reportError("office.member-account-delete-failed", new Error(first.error.message), { targetId });
    return NextResponse.json({ error: "Couldn't delete the account — nothing was changed. Please try again." }, { status: 500 });
  }

  const removal = await removeFromTeam(new Request(`${APP_URL}/api/office/members?id=${encodeURIComponent(memberId)}`, { method: "DELETE" }));
  if (!removal.ok) {
    const j = await removal.json().catch(() => ({}));
    await reportError("office.member-account-delete-removal-failed", new Error(String((j as { error?: string }).error ?? removal.status)), { targetId });
    return NextResponse.json({ error: "Their account was deleted, but removing them from the team didn't finish. Press Delete account again to complete it." }, { status: 500 });
  }

  const again = await markDeleted();
  if (again.error) await reportError("office.member-account-delete-reassert-failed", new Error(again.error.message), { targetId });

  await writeAudit({ action: "member.account_deleted", actorId: user.id, orgId: ctx.officeId, targetId });

  const subId = (profile.stripe_subscription_id as string | null) ?? null;
  after(async () => {
    if (subId) {
      const result = await stopSubscription(subId);
      if (result === "failed") {
        await reportError("billing.cancel-on-delete-failed", new Error(
          `Could not cancel ${subId} while an office owner deleted ${targetId} — retrying daily.`,
        ));
      } else {
        await admin.from("profiles").update({ stripe_subscription_id: null }).eq("id", targetId);
      }
    }
    try { await revokeAppleTokensOnDelete(target); } catch { /* never block deletion */ }
    // Tell them — they can't see anything in the app any more.
    if (target?.email) {
      const firstName = escapeHtml(((target.user_metadata?.name as string | undefined) ?? "").split(" ")[0] || "");
      await sendRawEmail({
        to: target.email,
        subject: "Your SwiftCard account was deleted",
        sender: "support",
        personal: true,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;font-size:15px;line-height:1.7;max-width:560px;margin:0 auto;padding:24px 16px;">
  <p style="margin:0 0 16px;">${firstName ? `Hi ${firstName},` : "Hi,"}</p>
  <p style="margin:0 0 16px;">Your team admin removed you from your team on SwiftCard and deleted your SwiftCard account. Your card, contacts and history are hidden now, and they'll be permanently removed in 30 days.</p>
  <p style="margin:0 0 16px;">If this was a mistake, sign in at <a href="${APP_URL}/login" style="color:#2563eb;">swiftcard.me</a> within 30 days and you'll be offered to reopen your account.</p>
  <p style="margin:0;color:#6b7280;font-size:13px;">Questions? Just reply to this email.</p>
</div>`,
      }).catch(() => "failed");
    }
  });

  return NextResponse.json({ ok: true });
}
