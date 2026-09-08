// ── Nora · Blog Writer ───────────────────────────────────────────────────────
// Runs on the brain (owner order 2026-09-08): research how a small-company
// blog should publish right now (the playbook, weekly), research what to write
// TODAY, write TWO complete different posts, queue them as one choice. The
// owner's pick goes live on /blog through the admin route — the only publish
// path (config.blog.publish_mode stays "draft"; nothing here writes
// agent_blog_posts).
import { readFileSync } from "node:fs";
import { safeMain, sb, extractJson, standDownIfUsageExhausted } from "./lib/agentkit.mjs";
import { askClaude, ensurePlaybook, playbookBlock, recentWorkBlock, intelBlock, openRequests, openRequestsBlock, queueChoice, fileRequest } from "./lib/brain.mjs";

const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const voice = readFileSync(new URL("./BRAND_VOICE.md", import.meta.url), "utf8");
const instructions = readFileSync(new URL("./agents/blog.md", import.meta.url), "utf8");

// Seeds, not a queue: topics we know convert, offered to the research step as
// candidates. Nora may pick one, or something better she found today.
const SEED_TOPICS = [
  "Best digital business card: Blinq vs. SwiftCard vs. HiHello",
  "Why you should have a digital business card",
  "SwiftCard vs Blinq", "SwiftCard vs Popl", "SwiftCard vs HiHello", "SwiftCard vs Mobilo", "SwiftCard vs Wave",
  "Best digital business card for realtors", "Best digital business card for contractors",
  "Best digital business card for consultants", "Best digital business card for sales teams",
  "NFC business cards: how they work", "QR code networking guide",
  "How to follow up after a conference", "Digital vs paper business cards",
];
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

await safeMain("blog", async (run) => {
  await standDownIfUsageExhausted(run);
  const playbook = await ensurePlaybook(run, instructions, { role: "Blog Writer", defaultCadence: config.agents.blog?.default_schedule ?? null });
  if (run.finished) return;
  await run.checkpoint();

  const [posts, topics] = await Promise.all([
    sb("GET", "agent_blog_posts", { params: "select=slug,title,keyword,status&limit=300" }).catch(() => []),
    sb("GET", "agent_blog_topics", { params: "select=topic,slug,status&limit=300" }).catch(() => []),
  ]);
  // A "declined" topic is the option the owner did not pick — free to come back
  // another day with a better angle, so it is not treated as covered.
  const liveTopics = (topics ?? []).filter((t) => t.slug && t.status !== "declined");
  const covered = new Set([...(posts ?? []).map((p) => p.slug), ...liveTopics.map((t) => t.slug)]);
  const existing = [
    ...(posts ?? []).map((p) => `- /blog/${p.slug} — "${p.title}" [${p.status}]`),
    ...liveTopics.filter((t) => !(posts ?? []).some((p) => p.slug === t.slug)).map((t) => `- /blog/${t.slug} — drafted: ${t.topic} [${t.status}]`),
  ];
  const seeds = SEED_TOPICS.filter((t) => !covered.has(norm(t)));
  const requests = await openRequests("blog");

  await run.note("Researching what to write today…");
  const prompt = [
    voice,
    `\n---\nTODAY: ${new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`,
    playbookBlock(playbook),
    await recentWorkBlock("blog"),
    await intelBlock(),
    openRequestsBlock(requests),
    `\n---\nPOSTS THAT ALREADY EXIST ON swiftcard.me/blog (never write these topics or slugs again):\n${existing.length ? existing.join("\n") : "(none yet)"}\nAlso hand-built and covered: /compare/blinq, /compare/hihello, /compare/popl, /compare/linq, /pricing, /templates, and the /for/* industry pages.`,
    `\n---\nSEED TOPICS we know convert (candidates, not orders — pick one only if today's research agrees):\n${seeds.map((s) => `- ${s}`).join("\n") || "(all seeds are written)"}`,
    `\n---\nCompetitor list: ${config.targets.competitors.join(", ")}.`,
    `\n---\nHOW YOU WORK TODAY (the brain):
1. RESEARCH what to write TODAY: search what our audience (realtors, contractors, sales people, consultants, small businesses) is asking right now about business cards, networking, follow-up and lead capture; what is ranking for those queries and where it is thin; anything seasonal for this date; anything competitors just changed (intel above). Pick the ONE best post for today and the ONE best alternative — genuinely different topics or angles, not one topic reworded.
2. WRITE BOTH POSTS IN FULL, each following the writing instructions below exactly (structure, length, verified competitor claims, internal links, CTA). Each must sway the reader towards trying SwiftCard without reading as an ad.
3. The owner picks one and it goes live. Never a third, never a stub.`,
    "\n---\n" + instructions,
    `\n---\nReturn ONLY a JSON array with exactly ONE element (no prose before or after):
[{"kind": "blog_post", "title": "<what this choice is about, 6-12 words>", "platform": "blog", "dedupe_key": "blog:<date>:<topic-slug-of-A>",
  "research": "<2-4 lines: what you found today and why these two>",
  "request_id": "<only if answering a request above>",
  "options": [
    {"label": "A", "headline": "<post title A>", "why_this": "<one line>", "content": "<the FULL post A in markdown>", "payload": {"slug": "kebab-case-slug-a", "title": "...", "description": "meta description ≤155 chars", "keyword": "target keyword", "og_title": "..."}},
    {"label": "B", "headline": "<post title B>", "why_this": "<one line>", "content": "<the FULL post B in markdown>", "payload": {"slug": "kebab-case-slug-b", "title": "...", "description": "...", "keyword": "...", "og_title": "..."}}
  ],
  "requests": [{"to": "video", "kind": "image", "brief": "<only if a hero image would truly help — what it should show>"}]
}]`,
  ].filter(Boolean).join("\n");

  const text = await askClaude(run, prompt, { maxTurns: 40 });
  if (text === null) return;
  await run.checkpoint();

  let items;
  try { items = extractJson(text); } catch { throw new Error("blog agent returned no parseable JSON; raw output length " + text.length); }
  if (!Array.isArray(items)) items = [items];
  const it = items[0];
  if (!it?.options?.length) { await run.finish("success", "Research found nothing worth writing today — no post queued."); return; }

  // Each option must be a publishable post: slug + title + body, and the slug
  // must not collide with anything already on the site.
  for (const o of it.options) {
    const p = o.payload ?? {};
    for (const k of ["slug", "title", "description"]) if (!p[k]) throw new Error(`option ${o.label} missing ${k}`);
    if (!o.content || o.content.length < 1500) throw new Error(`option ${o.label} is not a full post (${o.content?.length ?? 0} chars)`);
    if (covered.has(p.slug)) throw new Error(`option ${o.label} reuses an existing slug: ${p.slug}`);
    o.payload = { ...p, content_md: o.content, og_title: p.og_title ?? p.title };
  }
  const out = await queueChoice(run, it);
  if (out.result === "added") {
    for (const o of it.options) await sb("POST", "agent_blog_topics", { body: { topic: norm(o.payload.title), slug: o.payload.slug, title: o.payload.title, status: "proposed" } }).catch(() => {});
    for (const r of Array.isArray(it.requests) ? it.requests.slice(0, 1) : []) if (r?.to === "video") await fileRequest({ from_agent: "blog", to_agent: "video", kind: r.kind ?? "image", brief: r.brief, for_item: out.id });
  }
  await run.finish("success", out.result === "added"
    ? `Two posts written for the owner to pick from: A "${it.options[0].payload.title}" · B "${it.options[1].payload.title}". $${run.usageUsd.toFixed(2)}.`
    : `Nothing new queued (${out.result}). $${run.usageUsd.toFixed(2)}.`);
});
