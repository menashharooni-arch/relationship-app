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

await safeMain(agentId, async (run) => {
  await run.note("Researching…");
  const prompt = [
    voice,
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

  let added = 0, dup = 0;
  for (const it of items) {
    if (!it?.item_type || !it?.title) continue;
    const r = await run.addItem(it);
    if (r === "added") added++;
    if (r === "duplicate") dup++;
    if (r === "cap") break;
  }
  await run.finish("success", `${added} new item(s) queued (${dup} duplicate(s) skipped, ${items.length} candidates). Spend $${run.usageUsd.toFixed(2)}.`);
});
