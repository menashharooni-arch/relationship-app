import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { parseMentions, partyOfResponder } from "@/lib/agent-chat";
import { firstName } from "@/lib/agent-org";

// The company group chat (owner order 2026-09-08). The owner posts, @-mentions
// decide who answers, and every mentioned agent gets a chat turn dispatched as
// its own GitHub Actions run (agent-chat.yml) — one run per responder, so
// "@everyone" costs one run per agent. Replies land back in agent_chat from
// the runner; this route only writes the owner's side and the orders.
const REPO = process.env.AGENTS_GITHUB_REPO || "menashharooni-arch/relationship-app";
const CHAT_WORKFLOW = "agent-chat.yml";

async function dispatchChatTurn(responder: string): Promise<{ ok: boolean; status: number }> {
  if (!process.env.GITHUB_AGENTS_TOKEN) return { ok: false, status: 503 };
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${CHAT_WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GITHUB_AGENTS_TOKEN}`, Accept: "application/vnd.github+json" },
    body: JSON.stringify({ ref: "main", inputs: { agent: responder, trigger: "chat" } }),
  }).catch(() => null);
  return { ok: res?.status === 204, status: res?.status ?? 0 };
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  try {
    const admin = getAdminSupabase();
    const limit = Math.min(300, Number(p.get("limit") ?? 150));
    // Newest N, then flipped into reading order — the thread scrolls to the bottom.
    let q = admin.from("agent_chat").select("*").order("created_at", { ascending: false }).limit(limit);
    const after = p.get("after");
    if (after) q = q.gt("created_at", after);
    const { data, error } = await q;
    if (error) throw error;
    const messages = (data ?? []).reverse();
    const ids = messages.map((m) => m.id);
    const { data: orders } = ids.length
      ? await admin.from("agent_chat_orders").select("*").in("message_id", ids)
      : { data: [] as unknown[] };
    return NextResponse.json({ ready: true, messages, orders: orders ?? [], dispatch: !!process.env.GITHUB_AGENTS_TOKEN });
  } catch {
    return NextResponse.json({ ready: false, messages: [], orders: [], dispatch: !!process.env.GITHUB_AGENTS_TOKEN });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { body?: string } | null;
  const text = String(body?.body ?? "").trim().slice(0, 6000);
  if (!text) return NextResponse.json({ error: "empty message" }, { status: 400 });
  const { responders, unknown } = parseMentions(text);
  const admin = getAdminSupabase();

  const { data: msg, error } = await admin.from("agent_chat")
    .insert({ from_id: "owner", kind: "message", body: text, mentions: responders })
    .select("*").single();
  if (error || !msg) return NextResponse.json({ error: "chat tables missing — run supabase/agent-chat.sql", detail: error?.message }, { status: 503 });

  await admin.from("agent_chat_orders").insert(responders.map((responder) => ({ message_id: msg.id, responder })));

  // Wake every responder now. A failed dispatch leaves the order 'waiting' —
  // the watchdog loop retries those — and says so in the thread.
  const failed: string[] = [];
  for (const r of responders) {
    const out = await dispatchChatTurn(r);
    if (!out.ok) failed.push(`${firstName(partyOfResponder(r))} (${out.status || "no token"})`);
  }
  const notes: string[] = [];
  if (unknown.length) notes.push(`I didn't recognise @${unknown.slice(0, 3).join(", @")} — nobody by that name here.`);
  if (failed.length) notes.push(process.env.GITHUB_AGENTS_TOKEN
    ? `Couldn't wake ${failed.join(", ")} right away — the watchdog will retry in a few minutes.`
    : `Chat can't wake agents yet: GITHUB_AGENTS_TOKEN is not set in Vercel. Orders are saved and will run once it is.`);
  if (notes.length) await admin.from("agent_chat").insert({ from_id: "atlas", kind: "system", body: notes.join(" "), reply_to: msg.id }).then(() => {}, () => {});

  // The comms log keeps its one-line record of the order, like every other control.
  const who = responders.map((r) => firstName(partyOfResponder(r)));
  await admin.from("agent_messages").insert({
    from_id: "owner", to_id: responders.length === 1 ? partyOfResponder(responders[0]) : "atlas", kind: "owner_in",
    body: `💬 Chat → ${who.length > 4 ? `${who.length} agents` : who.join(", ")}: “${text.slice(0, 120)}”`,
  }).then(() => {}, () => {});

  return NextResponse.json({ ok: true, message: msg, responders, unknown, failed });
}
