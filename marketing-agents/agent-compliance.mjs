// ── Cody · Policy & Compliance Watch ────────────────────────────────────────
// Usage: node marketing-agents/agent-compliance.mjs
//
// Same shape as Cleo (agent-competitors.mjs): CODE does the watching, the LLM
// only reads. Every run hashes the visible text of the policy pages SwiftCard
// depends on (Apple review guidelines, Google OAuth policy, Twilio A2P rules,
// bulk-sender requirements, GDPR/CCPA summaries, Supabase/Vercel terms). A
// quiet run costs no tokens. When a page changes, Cody gets the BEFORE/AFTER
// diff and writes it up: the sentence that moved, what it means for us, two
// ways to respond. Nothing is sent anywhere — the owner decides.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { safeMain, sb, extractJson, standDownIfUsageExhausted } from "./lib/agentkit.mjs";
import { askClaude, ensurePlaybook, playbookBlock, recentWorkBlock, ownerChatBlock, queueChoice } from "./lib/brain.mjs";
import { focusBlock } from "./lib/insights.mjs";

const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const voice = readFileSync(new URL("./BRAND_VOICE.md", import.meta.url), "utf8");
const instructions = readFileSync(new URL("./agents/compliance.md", import.meta.url), "utf8");

const EXCERPT_CHARS = 12000;

// The pages, and why each one matters to THIS product (the LLM gets `why`).
const SOURCES = [
  { key: "apple-review-guidelines", url: "https://developer.apple.com/app-store/review/guidelines/", why: "In-app purchase, subscription, metadata and anti-steering rules — the iOS shell sells Pro through Apple." },
  { key: "apple-subscriptions", url: "https://developer.apple.com/app-store/subscriptions/", why: "Auto-renewable subscription requirements and trial rules for the 14-day Pro trial." },
  { key: "google-oauth-policy", url: "https://developers.google.com/terms/api-services-user-data-policy", why: "Google sign-in and the CRM connectors run on Google OAuth; verification/scope changes can block sign-in." },
  { key: "google-bulk-sender", url: "https://support.google.com/a/answer/81126", why: "Gmail's bulk-sender rules: authentication, one-click unsubscribe, the 0.3% spam-complaint ceiling." },
  { key: "twilio-a2p", url: "https://www.twilio.com/en-us/legal/messaging-policy", why: "SMS follow-ups go out on a registered A2P 10DLC campaign; consent and content rules move here." },
  { key: "ctia-messaging", url: "https://www.ctia.org/the-wireless-industry/industry-commitments/messaging-interoperability-sms-mms", why: "Carrier consent and STOP/HELP expectations behind the A2P campaign." },
  { key: "gdpr-summary", url: "https://gdpr.eu/what-is-gdpr/", why: "Lead capture stores contact details visitors hand over; data-subject rights and deletion timelines." },
  { key: "ccpa-summary", url: "https://oag.ca.gov/privacy/ccpa", why: "California rights over the same contact data; the privacy page and account deletion flow." },
  { key: "supabase-terms", url: "https://supabase.com/terms", why: "Database/auth provider terms — usually pricing or acceptable use, usually no action." },
  { key: "vercel-terms", url: "https://vercel.com/legal/terms", why: "Hosting provider terms — usually no action." },
  { key: "resend-terms", url: "https://resend.com/legal/terms-of-service", why: "Transactional email provider acceptable-use rules." },
];

function visibleText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ").replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

async function fetchText(url, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; SwiftCardBot/1.0; +https://swiftcard.me)", accept: "text/html" } });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; } finally { clearTimeout(timer); }
}

const sha = (s) => createHash("sha256").update(s).digest("hex");

/** Compare every watched page with its last snapshot. Returns the changes. */
async function detectChanges(run) {
  const changes = [];
  let checked = 0, unreachable = 0, firstSeen = 0, tableMissing = false;
  for (const s of SOURCES) {
    checked++;
    const html = await fetchText(s.url);
    const text = html ? visibleText(html) : null;
    if (!text || text.length < 200) { unreachable++; continue; }
    const excerpt = text.slice(0, EXCERPT_CHARS);
    const hash = sha(excerpt);
    let prev;
    try {
      prev = (await sb("GET", "agent_page_snapshots", { params: `source_key=eq.${s.key}&select=hash,excerpt,fetched_at&order=fetched_at.desc&limit=1` }))?.[0];
    } catch (e) {
      if (/404|does not exist|PGRST205/.test(String(e))) { tableMissing = true; break; }
      throw e;
    }
    if (prev?.hash === hash) continue;
    await sb("POST", "agent_page_snapshots", { body: { source_key: s.key, url: s.url, hash, excerpt } });
    if (!prev) { firstSeen++; continue; } // baseline — nothing to compare yet
    changes.push({ ...s, before: prev.excerpt ?? "", after: excerpt, since: prev.fetched_at });
  }
  if (!tableMissing) await run.note(`Checked ${checked} policy page(s): ${changes.length} changed, ${firstSeen} baselined, ${unreachable} unreachable.`);
  return { changes, tableMissing };
}

/** Rough diff: the sentences that appear on one side only, so the LLM reads the change, not two whole pages. */
function sentenceDiff(before, after) {
  const split = (t) => new Set(t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 20));
  const a = split(before), b = split(after);
  return {
    removed: [...a].filter((x) => !b.has(x)).slice(0, 40).join("\n"),
    added: [...b].filter((x) => !a.has(x)).slice(0, 40).join("\n"),
  };
}

await safeMain("compliance", async (run) => {
  const { changes, tableMissing } = await detectChanges(run);
  if (tableMissing) {
    await run.finish("success", "Cannot store page snapshots yet — the agent_page_snapshots table is missing. Owner to-do: run supabase/agent-brain.sql in the Supabase SQL editor. No tokens spent.");
    return;
  }
  await run.checkpoint();
  if (!changes.length) {
    await run.finish("success", "All quiet — no policy page changed since the last check. No tokens spent.");
    return;
  }

  await standDownIfUsageExhausted(run);
  const playbook = await ensurePlaybook(run, instructions, { role: "Policy & Compliance Watch", defaultCadence: config.agents.compliance?.default_schedule ?? null });
  if (run.finished) return;
  await run.checkpoint();

  const changeBlock = "\n---\nPOLICY PAGES THAT CHANGED SINCE THE LAST CHECK:\n" + changes.map((ch) => {
    const d = sentenceDiff(ch.before, ch.after);
    return `### ${ch.key} · ${ch.url} (last seen unchanged ${String(ch.since).slice(0, 10)})\nWHY IT MATTERS TO US: ${ch.why}\nREMOVED OR REWORDED (before):\n${d.removed || "(nothing removed)"}\nADDED OR REWORDED (after):\n${d.added || "(nothing added — likely reordering or formatting)"}`;
  }).join("\n\n");

  await run.note(`Reading ${changes.length} policy change(s)…`);
  const prompt = [
    voice,
    `\n---\nTODAY: ${new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`,
    await focusBlock(),
    playbookBlock(playbook),
    await recentWorkBlock("compliance"),
    await ownerChatBlock("compliance"),
    changeBlock,
    "\n---\n" + instructions,
    `\n---\nReturn ONLY a JSON array (no prose). One element per page whose change is REAL for SwiftCard (a formatting shuffle, a date stamp, a cookie banner, a reordered menu is NOT a change — return [] if every diff is noise):
{"kind": "policy_change", "title": "<Source: what changed, 6-12 words>", "platform": "internal", "target": "<source key>", "target_url": "<the page>", "dedupe_key": "policy:<source key>:<YYYY-MM-DD>",
 "research": "<the changed sentence QUOTED VERBATIM from the after side, the before text beside it if any; then three lines: what it now says, what SwiftCard does today that touches it, whether that is still allowed>",
 "options": [
   {"label": "A", "headline": "<response A>", "content": "<the complete response, written in full: the exact copy/setting/flow change to make, or 'No action — here is why'>", "why_this": "<one line>", "payload": {"source": "<key>", "risk": "high|medium|low|none", "deadline": "<date or null>", "touches": ["<file, page or setting>"]}},
   {"label": "B", "headline": "...", "content": "...", "why_this": "...", "payload": {}}
 ]}`,
  ].filter(Boolean).join("\n");

  const text = await askClaude(run, prompt, { maxTurns: 25 });
  if (text === null) return;
  await run.checkpoint();

  let items;
  try { items = extractJson(text); } catch { throw new Error("compliance agent returned no parseable JSON; raw output length " + text.length); }
  if (!Array.isArray(items)) items = [items];
  let added = 0, dup = 0;
  for (const it of items) {
    const out = await queueChoice(run, it);
    if (out.result === "added") added++;
    if (out.result === "duplicate") dup++;
    if (out.result === "cap") break;
  }
  await run.finish("success", `${added} policy change(s) written up for you${dup ? ` (${dup} already reported)` : ""}. Changed pages: ${changes.map((c) => c.key).join(", ")}. $${run.usageUsd.toFixed(2)}.`);
});
