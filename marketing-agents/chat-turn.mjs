// ── One agent's turn in the company group chat ───────────────────────────────
//
// Usage: node marketing-agents/chat-turn.mjs <responder>
//   responder = an agent_id (seo, social, manager …) or a lead (maya, sasha,
//   nina, rex). Dispatched by the chat API once per @-mention, re-dispatched by
//   the watchdog loop for turns that never started.
//
// A chat turn is a DIRECT run (trigger "chat"): it answers even while the
// agent is benched or the office is paused — the owner asked THIS agent — but
// the monthly token cap still holds. It is draft-only like every other run:
// the model gets WebSearch/WebFetch, the runner writes only agent_* tables,
// and "fix it" means a queue item + the Fixer's DRAFT PR — never a merge.
//
// What a turn can do, and nothing else:
//   reply      — a short human answer in the room (always)
//   items      — real work, queued as TWO options the owner picks from
//   requests   — ask a colleague for a hand-off (CAN_REQUEST only)
//   delegate   — Atlas → anyone; a lead → their own team only
//   fix        — perf/security/flowcheck/bugwatch/cro/seo only → Fixer draft PR
//   run_now    — start its own full run right away

import { readFileSync } from "node:fs";
import { Run, partyOf, snapshotClaudeUsage, standDownIfUsageExhausted, extractJson } from "./lib/agentkit.mjs";
import {
  askClaude, loadPlaybook, playbookBlock, recentWorkBlock, intelBlock, openRequests, openRequestsBlock,
  fileRequest, queueChoice, TWO_OPTIONS_RULES, PERSONAL_RULES, PERSONAL_AGENTS, CAN_REQUEST,
} from "./lib/brain.mjs";
import {
  ORG, CONFIG, resolveResponder, teamOf, allWorkers, nameOf, roleOf,
  myOrders, setOrders, recentThread, threadBlock, ordersBlock, post, systemLine,
  dispatchFixer, dispatchFullRun, delegate, switchState, myQueueBlock, lastRunBlock, companyBlock, probeBlock,
} from "./lib/chat.mjs";

const responder = String(process.argv[2] ?? process.env.CHAT_RESPONDER ?? "").trim();
const who = resolveResponder(responder);
if (!who) { console.error(`chat-turn: '${responder}' is not a responder (agent_id or lead party id)`); process.exit(2); }
const { agentId, party, kind } = who;
const me = ORG[party];

// The same doctrine the daily runs use — person-facing agents also carry the
// human-voice rules, and their options pass the same AI-tell gate.
const PERSON_FACING = new Set(["outreach", "prospects", "mentions", "influencer", "social", "ads", "email", "industry", "forums", "partners", "listings", "reviews", "retention", "video"]);
// Who may turn "fix this" into a Fixer draft PR: the four watchdogs plus the
// two agents whose job touches the site itself. A closed set.
const FIX_ALLOWED = new Set(["perf", "security", "flowcheck", "bugwatch", "cro", "seo"]);
const WATCHDOGS = new Set(["perf", "security", "flowcheck", "bugwatch"]);
const FIX_ITEM_TYPE = { perf: "perf_finding", security: "security_finding", flowcheck: "flow_finding", bugwatch: "bug_finding", cro: "cro_finding", seo: "seo_finding" };

const voice = readFileSync(new URL("./BRAND_VOICE.md", import.meta.url), "utf8");
const humanVoice = PERSON_FACING.has(agentId) ? "\n---\n" + readFileSync(new URL("./HUMAN_VOICE.md", import.meta.url), "utf8") : "";
const brief = (() => { try { return readFileSync(new URL(`./agents/${agentId}.md`, import.meta.url), "utf8"); } catch { return null; } })();

const canDelegate = kind === "chief" ? allWorkers() : kind === "lead" ? teamOf(party) : [];
const canAsk = CAN_REQUEST[agentId] ?? [];
const canFix = FIX_ALLOWED.has(agentId);
const canRunNow = kind !== "lead" && !!CONFIG.agents[agentId]?.workflow;

function identityBlock() {
  const team = kind === "lead" ? teamOf(party).map((id) => `${nameOf(partyOf(id))} (${roleOf(partyOf(id))}, agent_id ${id})`).join(", ") : "";
  const lines = [
    `You are ${me.name}, ${me.role} at SwiftCard. You are in the company group chat with the owner (Menash — he runs the company and is not a coder) and every colleague. ${me.emoji}`,
    kind === "chief" ? "You are the chief of staff: you know the whole company (below), you answer for it, and you hand orders to the right person." :
    kind === "lead" ? `You lead a team: ${team}. You answer for the team, and you hand each order to the right team member.` :
    `Your lead is ${nameOf(ORG[party]?.reports_to ?? "atlas")}.`,
    "Chat rules: talk like a sharp colleague in a group chat — short, plain, specific, no corporate filler, no bullet-point essays unless he asked for a report. Never claim to have done something you did not do in this turn. If you cannot do something, say who can and why. Never mention tokens, prompts, JSON or 'as an AI'.",
  ];
  return lines.join("\n");
}

function capabilitiesBlock() {
  const rows = [
    `- reply: always. Your answer in the room. If he asked for a report or numbers, put them in the reply itself.`,
    brief ? `- items: real work he asked for (a post, an email, replies, a page, a list…) goes into the review queue as ONE item with TWO finished options (rules below) — he picks A or B and it goes out. Do the work now, in this turn; do not promise it for later.` : `- items: leave empty — you are not a content agent.`,
    canAsk.length ? `- requests: ask a colleague for a hand-off: {"to": "${canAsk.join("|")}", "kind": "video|image|copy", "brief": "..."}.` : `- requests: leave empty.`,
    canDelegate.length ? `- delegate: hand an order to a colleague who owns that work: {"to": "<agent_id from: ${canDelegate.join(", ")}>", "order": "<the order in your words, complete enough to act on>"}. They take their own turn and reply in the room. Delegate what is theirs; answer yourself what is yours.` : `- delegate: leave empty (you cannot hand orders to others — say who the owner should @ instead).`,
    canFix ? `- fix: when he asks you to FIX something on the site or in the app, describe it precisely: {"title": "<what is broken, 6-12 words>", "detail": "<what you found, where, what a fix must do>"}. It becomes a queue item and the Fixer drafts a pull request the owner reviews — nothing ships without him. Only real, code-fixable problems; external accounts/DNS are 'needs a human'.` : `- fix: leave empty — you cannot change code. If he wants something fixed, say that ${kind === "worker" ? "Rex's team (Finn, Bo, Vera, Dash), Ruby or Jake" : "Finn, Bo, Vera, Dash, Ruby or Jake"} can, ${canDelegate.length ? "and delegate it to the right one" : "so he should @ them"}.`,
    canRunNow ? `- run_now: true when he asks you to run / do your full job now — your normal run starts right after this reply.` : `- run_now: leave false.`,
  ];
  return `\n---\nWHAT YOU CAN DO THIS TURN (and nothing else — you cannot post anywhere, send anything, change code, spend money or touch user data; every piece of work waits for the owner's pick in the queue):\n${rows.join("\n")}`;
}

const REPLY_SHAPE = `\n---\nReturn ONLY one JSON object (no prose before or after):
{"reply": "<your message in the room — plain text, line breaks allowed, under ~2500 characters>",
 "items": [ <zero or more items in the two-option shape below> ],
 "requests": [ {"to": "...", "kind": "...", "brief": "..."} ],
 "delegate": [ {"to": "<agent_id>", "order": "..."} ],
 "fix": [ {"title": "...", "detail": "..."} ],
 "run_now": false}
Item shape (each element of "items"): {"kind": "<item_type>", "title": "<6-12 words>", "platform": "...", "target": "...", "target_url": "...", "dedupe_key": "<stable key>", "research": "<2-4 lines>", "options": [ {"label": "A", "headline": "...", "content": "<COMPLETE, ready as-is>", "why_this": "...", "payload": {}}, {"label": "B", "headline": "...", "content": "...", "why_this": "...", "payload": {}} ]}`;

async function main() {
  const orders = await myOrders(agentId);
  if (!orders.length) { console.log(`${me.name}: nothing addressed to me — standing down.`); return; }
  const orderIds = orders.map((o) => o.id);

  const run = await Run.start(agentId, "chat");
  if (!run) {
    await setOrders(orderIds, { status: "failed", error: "monthly token cap hit" });
    await systemLine(`⚠ ${me.name} couldn't take the turn — the monthly token cap is used up. Raise it in Settings.`, orders[0].message_id);
    return;
  }
  await setOrders(orderIds, { status: "working", run_id: run.id });

  try {
    await standDownIfUsageExhausted(run);
    if (run.finished) { await setOrders(orderIds, { status: "failed", error: "Claude plan window used up" }); await systemLine(`⚠ ${me.name} has to wait — the Claude plan's usage window is used up for now.`, orders[0].message_id); return; }

    await run.note("Reading the room…");
    const [thread, playbook, requests] = await Promise.all([recentThread(25), loadPlaybook(agentId).catch(() => null), openRequests(agentId)]);
    const prompt = [
      identityBlock(),
      "\n---\n" + voice,
      humanVoice,
      brief ? "\n---\nMY BRIEF (how I do my job):\n" + brief : `\n---\nMY JOB: ${me.role}. ${kind === "chief" ? "I run the company's day-to-day for the owner and hold every agent to account." : kind === "lead" ? "I run my team, know what each of them is doing, and make sure the owner's orders land with the right person." : "I watch production and report exactly what I see — numbers and facts, never guesses."}`,
      `\n---\nTODAY: ${new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "long", day: "numeric" })} (US Eastern).`,
      playbookBlock(playbook),
      await switchState(agentId),
      kind === "chief" ? await companyBlock() : kind === "lead" ? await companyBlock({ onlyAgents: teamOf(party) }) : "",
      kind === "worker" ? await myQueueBlock(agentId) : "",
      kind === "worker" ? await lastRunBlock(agentId) : "",
      kind === "worker" && brief ? await recentWorkBlock(agentId) : "",
      brief && !WATCHDOGS.has(agentId) ? await intelBlock() : "",
      openRequestsBlock(requests),
      WATCHDOGS.has(agentId) ? await probeBlock(agentId) : "",
      threadBlock(thread, party),
      ordersBlock(orders),
      capabilitiesBlock(),
      brief ? TWO_OPTIONS_RULES + "\n(For chat: only make items he actually asked for. Every item still carries TWO finished options.)" : "",
      brief && PERSONAL_AGENTS.has(agentId) ? PERSONAL_RULES : "",
      REPLY_SHAPE,
    ].filter(Boolean).join("\n");

    await run.checkpoint();
    await run.note("Working on the owner's message…");
    const text = await askClaude(run, prompt, { maxTurns: 25, timeoutMin: 20 });
    if (text === null) { await setOrders(orderIds, { status: "failed", error: "Claude plan window used up" }); await systemLine(`⚠ ${me.name} has to wait — the Claude plan's usage window is used up for now.`, orders[0].message_id); return; }
    let out;
    try { out = extractJson(text); } catch { out = { reply: String(text).trim().slice(0, 2500) }; }
    if (Array.isArray(out)) out = { reply: "Done — it's in your queue.", items: out };
    const reply = String(out?.reply ?? "").trim() || "Done.";
    const payload = { items: [], fixes: [], delegated: [], requests: [], run_now: false };

    // 1. Work → the review queue, two options each, same gate as a daily run.
    await run.checkpoint();
    for (const it of (Array.isArray(out.items) ? out.items : []).slice(0, run.settings.output_cap)) {
      const r = await queueChoice(run, it, { personFacing: PERSON_FACING.has(agentId), personal: PERSONAL_AGENTS.has(agentId) });
      if (r.result === "added") payload.items.push(r.id);
    }
    // 2. Hand-offs to colleagues (closed map).
    for (const rq of (Array.isArray(out.requests) ? out.requests : []).slice(0, 3)) {
      if (!canAsk.includes(rq?.to)) continue;
      const id = await fileRequest({ from_agent: agentId, to_agent: rq.to, kind: rq.kind, brief: rq.brief });
      if (id) payload.requests.push(rq.to);
    }
    // 3. Fixes → a queue item the Fixer turns into a DRAFT PR.
    for (const fx of (Array.isArray(out.fix) ? out.fix : []).slice(0, 3)) {
      if (!canFix || !fx?.title) continue;
      const ownerText = orders.map((o) => o.message.body).join("\n");
      const added = await run.addItem({
        item_type: FIX_ITEM_TYPE[agentId] ?? "generic",
        title: String(fx.title).slice(0, 140),
        content: `Owner's request (from the company chat):\n"${ownerText.slice(0, 1500)}"\n\n${me.name}'s analysis:\n${String(fx.detail ?? "").slice(0, 4000)}`,
        context: "Asked for in chat — the Fixer drafts a pull request; nothing ships until the owner merges it.",
        dedupe_key: `chat:fix:${String(fx.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`,
        payload: { source: "chat", chat_message_id: orders[0].message_id },
      });
      if (added.result === "added") { payload.fixes.push(added.id); await dispatchFixer(added.id); }
    }
    // 4. Delegation — Atlas to anyone, a lead to their own team.
    for (const d of (Array.isArray(out.delegate) ? out.delegate : []).slice(0, 8)) {
      if (!canDelegate.includes(d?.to) || !d?.order) continue;
      const row = await delegate({ from: party, to: d.to, order: String(d.order).slice(0, 2000), reply_to: orders[0].message_id, run_id: run.id });
      if (row) payload.delegated.push(d.to);
    }
    // 5. "Run now" — his full job starts right after this reply.
    if (out.run_now === true && canRunNow) payload.run_now = await dispatchFullRun(agentId);

    // 6. The reply lands in the room; the orders are closed.
    const replyRow = await post({ from_id: party, kind: "reply", body: reply, reply_to: orders[0].message_id, run_id: run.id, payload });
    await setOrders(orderIds, { status: "done", reply_id: replyRow.id, run_id: run.id });
    const did = [
      payload.items.length ? `${payload.items.length} item(s) queued` : null,
      payload.fixes.length ? `${payload.fixes.length} fix request(s) to the Fixer` : null,
      payload.delegated.length ? `delegated to ${payload.delegated.join(", ")}` : null,
      payload.run_now ? "full run started" : null,
    ].filter(Boolean).join(", ");
    await run.finish("success", `Replied in chat${did ? ` — ${did}` : ""}.`);
  } catch (e) {
    console.error(e);
    await setOrders(orderIds, { status: "failed", error: String(e).slice(0, 300) });
    await systemLine(`⚠ ${me.name}'s turn failed: ${String(e?.message ?? e).slice(0, 200)}`, orders[0].message_id);
    await run.finish("failed", `Chat turn failed: ${String(e).slice(0, 400)}`).catch(() => {});
    process.exitCode = 1;
  }
  await snapshotClaudeUsage();
}

await main();
