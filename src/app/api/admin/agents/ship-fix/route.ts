import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase-admin";

// "✓ Approve & Ship fix" — the owner's one click that merges a Fixer draft PR
// from inside the Agent Flow queue (owner order 2026-09-02: find → show →
// approve → it fixes itself). Merging auto-deploys; the deploy watchdog
// guards the other side.
//
// THE GUARDRAILS (pinned in tests) — this route merges a PR only when ALL of:
//   • the caller is the admin (requireAdmin);
//   • the PR is referenced by a real agent queue item's payload.pr_url;
//   • it lives in OUR repo, targets main, and its head branch is agent-fix/*
//     — the Fixer's own branches, nothing else is mergeable from here;
//   • every check run on its head commit has completed successfully.
// It can therefore never merge arbitrary PRs, and never merges code whose
// tests aren't green.

const REPO = process.env.AGENTS_GITHUB_REPO || "menashharooni-arch/relationship-app";
const GH = "https://api.github.com";

function ghHeaders() {
  return { Authorization: `Bearer ${process.env.GITHUB_AGENTS_TOKEN}`, Accept: "application/vnd.github+json" };
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!process.env.GITHUB_AGENTS_TOKEN) return NextResponse.json({ error: "GITHUB_AGENTS_TOKEN is not set in Vercel." }, { status: 503 });
  const { item_id } = (await req.json().catch(() => ({}))) as { item_id?: string };
  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: item } = await admin.from("agent_queue_items").select("*").eq("id", item_id).maybeSingle();
  const prUrl = (item?.payload as Record<string, unknown> | null)?.pr_url;
  if (typeof prUrl !== "string") return NextResponse.json({ error: "This item has no Fixer PR attached." }, { status: 400 });
  const m = prUrl.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)$/);
  if (!m || m[1] !== REPO) return NextResponse.json({ error: "The attached PR is not in our repository." }, { status: 400 });
  const prNumber = m[2];

  // The PR must be the Fixer's own work, open, and aimed at main.
  const pr = (await fetch(`${GH}/repos/${REPO}/pulls/${prNumber}`, { headers: ghHeaders() }).then((r) => (r.ok ? r.json() : null))) as
    | { state: string; draft: boolean; merged: boolean; base: { ref: string }; head: { ref: string; sha: string }; node_id: string; title: string }
    | null;
  if (!pr) return NextResponse.json({ error: "Couldn't read the PR from GitHub." }, { status: 502 });
  if (pr.merged) return NextResponse.json({ ok: true, already: true, message: "That fix is already shipped." });
  if (pr.state !== "open") return NextResponse.json({ error: "The PR is closed — reopen it on GitHub if it should ship." }, { status: 409 });
  if (pr.base.ref !== "main") return NextResponse.json({ error: `PR targets ${pr.base.ref}, not main — refusing.` }, { status: 409 });
  if (!pr.head.ref.startsWith("agent-fix/")) return NextResponse.json({ error: "Only the Fixer's own agent-fix/* branches can ship from here." }, { status: 409 });

  // Tests must be green: every check run on the head commit completed + passed.
  const checks = (await fetch(`${GH}/repos/${REPO}/commits/${pr.head.sha}/check-runs?per_page=50`, { headers: ghHeaders() }).then((r) => (r.ok ? r.json() : null))) as
    | { check_runs: Array<{ name: string; status: string; conclusion: string | null }> }
    | null;
  const runs = checks?.check_runs ?? [];
  const pending = runs.filter((c) => c.status !== "completed");
  if (pending.length) return NextResponse.json({ error: `Checks still running (${pending[0].name}) — try again in a minute.` }, { status: 409 });
  const failed = runs.filter((c) => !["success", "neutral", "skipped"].includes(c.conclusion ?? ""));
  if (failed.length) return NextResponse.json({ error: `Check "${failed[0].name}" is ${failed[0].conclusion} — a fix with red tests never ships.` }, { status: 409 });

  // Draft PRs need marking ready first (REST cannot; GraphQL can).
  if (pr.draft) {
    const g = await fetch(`${GH}/graphql`, {
      method: "POST", headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ query: `mutation($id:ID!){ markPullRequestReadyForReview(input:{pullRequestId:$id}){ pullRequest { number } } }`, variables: { id: pr.node_id } }),
    }).then((r) => r.json()).catch(() => null);
    if (!g || g.errors) return NextResponse.json({ error: "Couldn't mark the draft ready — the PAT may need 'Pull requests: write'." }, { status: 502 });
  }

  const merge = await fetch(`${GH}/repos/${REPO}/pulls/${prNumber}/merge`, {
    method: "PUT", headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ merge_method: "squash" }),
  });
  if (!merge.ok) {
    const detail = ((await merge.json().catch(() => ({}))) as { message?: string }).message ?? merge.status;
    const hint = merge.status === 403 ? " — the GITHUB_AGENTS_TOKEN PAT needs 'Contents: write' + 'Pull requests: write'." : "";
    return NextResponse.json({ error: `GitHub refused the merge: ${detail}${hint}` }, { status: 502 });
  }

  const now = new Date().toISOString();
  await admin.from("agent_queue_items").update({
    status: "acknowledged", actioned_at: now,
    payload: { ...(item!.payload as Record<string, unknown>), fix_shipped: true, fix_shipped_at: now },
  }).eq("id", item_id);
  const user = await requireAdmin();
  await admin.from("agent_action_history").insert({ item_id, action: "fix_shipped", actor_email: user!.email });
  await admin.from("agent_messages").insert({
    from_id: "atlas", to_id: "owner", kind: "owner_out",
    body: `🚀 Fix shipped — you approved “${pr.title.slice(0, 80)}” (PR #${prNumber}); it merged and is deploying now. The deploy watchdog is standing guard.`,
  }).then(() => {}, () => {});
  return NextResponse.json({ ok: true, merged: true, pr: prNumber });
}
