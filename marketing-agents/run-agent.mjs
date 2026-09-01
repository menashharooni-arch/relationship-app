// ── Generic LLM agent runner ─────────────────────────────────────────────────
// Usage: node marketing-agents/run-agent.mjs <agent_id>
//
// Loads marketing-agents/agents/<agent_id>.md (the agent's instructions), runs
// Claude Code CLI headless with ONLY research tools (WebSearch/WebFetch/Read),
// parses the JSON items the agent returns, and queues them for review.
//
// STRUCTURALLY DRAFT-ONLY for third-party platforms: the CLI gets no Bash, no
// git, no gh, no posting API of any kind — its entire output is text parsed by
// this script, and this script's only write is Run.addItem() into our own
// queue tables. There is no code path that can post, DM, or comment anywhere.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { safeMain, parseClaudeJson, extractJson } from "./lib/agentkit.mjs";

const agentId = process.argv[2];
if (!agentId) { console.error("usage: run-agent.mjs <agent_id>"); process.exit(2); }

const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const voice = readFileSync(new URL("./BRAND_VOICE.md", import.meta.url), "utf8");
const instructions = readFileSync(new URL(`./agents/${agentId}.md`, import.meta.url), "utf8");

// Agents that write TO real people also get the human-voice doctrine, and
// their output passes the tell-filter below before anything reaches the queue.
const PERSON_FACING = new Set(["outreach", "mentions", "influencer", "social"]);
const humanVoice = PERSON_FACING.has(agentId)
  ? "\n---\n" + readFileSync(new URL("./HUMAN_VOICE.md", import.meta.url), "utf8")
  : "";

// Hard filter: high-precision AI-tell phrases. A draft containing one is
// DISCARDED (counted in the run summary) rather than queued — the owner's
// rule is that robotic-sounding copy must never reach a real person, and a
// filter the model can't argue with beats an instruction it might drift from.
const AI_TELLS = [
  /i hope this (message |email )?finds you well/i,
  /i came across your/i,
  /i couldn'?t help but notice/i,
  /just wanted to reach out/i,
  /i'?d love to (connect|chat|hop on)/i,
  /feel free to/i,
  /as someone who/i,
  /really resonated/i,
  /hope (that|this) helps!/i,
  /game.?changer/i, /seamless/i, /streamline/i, /leverage/i, /elevate your/i,
  /unlock (the|your)/i, /delve/i, /navigat(e|ing) the .{0,20}landscape/i,
  /in today'?s fast.?paced/i, /it'?s worth noting/i,
  /^(additionally|moreover|furthermore),/im,
  /not only .{3,60} but also/i,
  /best regards/i,
  /🚀|✨/u,
];
function soundsHuman(text) {
  if (!text) return { ok: true };
  for (const re of AI_TELLS) { const m = text.match(re); if (m) return { ok: false, tell: m[0] }; }
  return { ok: true };
}

await safeMain(agentId, async (run) => {
  await run.note("Researching…");
  const prompt = [
    voice,
    humanVoice,
    "\n---\nCENTRAL CONFIG (target lists):\n" + JSON.stringify(config.targets, null, 1),
    `\n---\nOUTPUT CAP for this run: at most ${run.settings.output_cap} items. Quality over volume — fewer, better items always win.`,
    "\n---\n" + instructions,
    `\n---\nReturn ONLY a JSON array of items (no prose before or after), each:
{"item_type": "...", "title": "...", "content": "...", "context": "...", "platform": "...", "target": "...", "target_url": "...", "dedupe_key": "...", "payload": { }}
item_type and the field meanings are defined in the instructions above. dedupe_key must be a stable identifier (platform:handle or the thread URL) so the same person/thread is never surfaced twice across runs. If you found nothing good enough, return [].`,
  ].join("\n");

  await run.checkpoint();
  const t0 = Date.now();
  const stdout = execFileSync("claude", [
    "-p", prompt,
    "--output-format", "json",
    "--allowedTools", "WebSearch,WebFetch",
    "--max-turns", "40",
  ], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 25 * 60 * 1000 });

  const { text, costUsd, tokens } = parseClaudeJson(stdout);
  run.addUsage(costUsd, tokens);
  await run.note(`Research done in ${Math.round((Date.now() - t0) / 1000)}s ($${Number(costUsd).toFixed(2)}). Queuing items…`);
  await run.checkpoint();

  let items;
  try { items = extractJson(text); } catch { throw new Error("agent returned no parseable JSON items; raw output length " + text.length); }
  if (!Array.isArray(items)) items = [items];

  let added = 0, dup = 0, robotic = 0;
  for (const it of items) {
    if (!it?.item_type || !it?.title) continue;
    if (PERSON_FACING.has(agentId)) {
      const check = soundsHuman(it.content ?? "");
      if (!check.ok) { robotic++; console.log(`discarded (AI tell "${check.tell}"): ${it.title}`); continue; }
    }
    const { result } = await run.addItem(it);
    if (result === "added") added++;
    if (result === "duplicate") dup++;
    if (result === "cap") break;
  }
  await run.finish("success", `${added} new item(s) queued (${dup} duplicate(s) skipped${robotic ? `, ${robotic} DISCARDED for AI-sounding language` : ""}, ${items.length} candidates). Spend $${run.usageUsd.toFixed(2)}.`);
});
