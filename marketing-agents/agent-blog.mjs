// ── Agent 4: Blog Writer ─────────────────────────────────────────────────────
// Default DRAFT mode: the post lands in the review queue; the Publish button in
// the Agent Flow tab flips it live on /blog. config.blog.publish_mode="auto"
// switches to publish-on-run (only after the owner flips it deliberately).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { safeMain, sb, parseClaudeJson, extractJson } from "./lib/agentkit.mjs";

const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const voice = readFileSync(new URL("./BRAND_VOICE.md", import.meta.url), "utf8");
const instructions = readFileSync(new URL("./agents/blog.md", import.meta.url), "utf8");

const PRIORITY_TOPICS = [
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
  const done = await sb("GET", "agent_blog_topics", { params: "select=topic" });
  const doneSet = new Set((done ?? []).map((r) => r.topic));
  const topic = PRIORITY_TOPICS.find((t) => !doneSet.has(norm(t)));
  if (!topic) { await run.finish("success", "Every priority topic already has a post — nothing to write. Add topics to PRIORITY_TOPICS."); return; }

  await run.note(`Writing: "${topic}" (verifying competitor claims live)…`);
  const prompt = `${voice}\n---\n${instructions}\n---\nTOPIC: ${topic}\nCompetitor list: ${config.targets.competitors.join(", ")}.`;
  const stdout = execFileSync("claude", ["-p", prompt, "--output-format", "json", "--allowedTools", "WebSearch,WebFetch", "--max-turns", "30"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 25 * 60 * 1000 });
  const { text, costUsd, tokens } = parseClaudeJson(stdout);
  run.addUsage(costUsd, tokens);
  await run.checkpoint();

  const post = extractJson(text);
  for (const k of ["slug", "title", "description", "content_md"]) if (!post?.[k]) throw new Error(`post missing ${k}`);

  const mode = config.blog?.publish_mode === "auto" ? "auto" : "draft";
  await run.addItem({
    item_type: "blog_post",
    title: `${mode === "auto" ? "[published] " : ""}${post.title}`,
    content: post.content_md,
    context: `Topic: ${topic} · keyword: ${post.keyword ?? "-"} · slug: /blog/${post.slug} · mode: ${mode}`,
    platform: "blog",
    target: post.slug,
    target_url: `https://swiftcard.me/blog/${post.slug}`,
    dedupe_key: `blog:${post.slug}`,
    payload: post,
  });
  await sb("POST", "agent_blog_topics", { body: { topic: norm(topic), slug: post.slug, title: post.title, status: mode === "auto" ? "published" : "drafted" } }).catch(() => {});
  if (mode === "auto") {
    await sb("POST", "agent_blog_posts", { body: { slug: post.slug, title: post.title, description: post.description, keyword: post.keyword ?? null, og_title: post.og_title ?? post.title, content_md: post.content_md, status: "published", published_at: new Date().toISOString() }, prefer: "resolution=merge-duplicates" });
  }
  await run.finish("success", `Wrote "${post.title}" (${post.content_md.length} chars) — ${mode === "auto" ? "PUBLISHED to /blog" : "queued as DRAFT for review"}. $${run.usageUsd.toFixed(2)}.`);
});
