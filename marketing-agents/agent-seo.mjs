// ── Agent 3: SEO — deterministic own-site checks, zero LLM cost ──────────────
// Autonomous on OUR site only: it verifies what's live and reports. The
// heavy own-site work it exists to "maintain" (dynamic sitemap, robots,
// Organization JSON-LD with alternateName, per-page metadata, landing pages)
// already ships in the app — this agent is the regression tripwire + reporter.
import { safeMain } from "./lib/agentkit.mjs";

const SITE = "https://swiftcard.me";
const BRAND_VARIATIONS = ["SwiftCard", "Swift Card", "swiftcard.me", "swift card app"];

async function get(path) {
  const res = await fetch(SITE + path, { headers: { "User-Agent": "SwiftCardSEOAgent/1.0" }, redirect: "manual" });
  return { status: res.status, text: res.status === 200 ? await res.text() : "", location: res.headers.get("location") };
}

await safeMain("seo", async (run) => {
  const findings = [];
  const ok = [];

  await run.note("Checking sitemap, robots, and structured data…");
  const [home, sitemap, robots] = await Promise.all([get("/"), get("/sitemap.xml"), get("/robots.txt")]);

  if (sitemap.status !== 200) findings.push("sitemap.xml did not return 200");
  else {
    const locs = (sitemap.text.match(/<loc>/g) ?? []).length;
    ok.push(`sitemap.xml: ${locs} URLs (dynamic — includes live cards + Swift Links)`);
    if (locs < 40) findings.push(`sitemap has only ${locs} URLs — the dynamic user section may be failing (DB error degrades to marketing-only)`);
  }
  if (robots.status !== 200 || !robots.text.includes("Disallow: /dashboard")) findings.push("robots.txt missing or no longer disallowing /dashboard");
  else ok.push("robots.txt: app/admin routes disallowed, public crawlable");

  if (home.status !== 200) findings.push(`homepage returned ${home.status}`);
  else {
    for (const [what, re] of [
      ["Organization JSON-LD", /"@type":\s*"Organization"/],
      ["WebSite JSON-LD", /"@type":\s*"WebSite"/],
      ["SoftwareApplication JSON-LD", /"@type":\s*"SoftwareApplication"/],
      ["meta description", /name="description" content="[^"]{40,}/],
      ["OG tags", /property="og:title"/],
      ["legal name Swift Card Inc", /Swift Card Inc/],
    ]) {
      if (re.test(home.text)) ok.push(`homepage: ${what} present`);
      else findings.push(`homepage: ${what} MISSING`);
    }
    const missingVariants = BRAND_VARIATIONS.filter((v) => !home.text.toLowerCase().includes(v.toLowerCase()));
    if (missingVariants.length) findings.push(`brand variations absent from homepage markup/schema: ${missingVariants.join(", ")}`);
    else ok.push("brand-variation coverage: all present via alternateName/copy");
  }

  await run.checkpoint();
  await run.note("Sampling sitemap URLs for broken links…");
  const urls = [...(sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g))].map((m) => m[1]).filter((u) => !/\/links\//.test(u)).slice(0, 25);
  let broken = 0;
  for (const u of urls) {
    const res = await fetch(u, { method: "GET", headers: { "User-Agent": "SwiftCardSEOAgent/1.0" } }).catch(() => null);
    if (!res || res.status >= 400) { broken++; findings.push(`broken sitemap URL: ${u} → ${res ? res.status : "unreachable"}`); }
  }
  ok.push(`link check: ${urls.length - broken}/${urls.length} sampled sitemap URLs healthy`);

  const manualSteps = [
    "Google Search Console: swiftcard.me is VERIFIED and the sitemap submitted (done 2026-08-17). Weekly: Performance → filter the target queries.",
    "Request indexing for new pages: GSC → URL Inspection → paste URL → Request Indexing (do for new blog posts/landing pages).",
    "Knowledge panel: once Google shows a SwiftCard panel, use its 'Claim this knowledge panel' link while signed in as hello@swiftcard.me.",
    "Keyword positions: GSC → Performance → Queries (no API wired yet — this report cannot pull positions itself).",
  ];

  const item = await run.addItem({
    item_type: "seo_report",
    title: `SEO check: ${findings.length ? findings.length + " finding(s)" : "all clear"} — ${new Date().toISOString().slice(0, 10)}`,
    content: [
      findings.length ? "FINDINGS (fix these):\n- " + findings.join("\n- ") : "No regressions found.",
      "\nVERIFIED HEALTHY:\n- " + ok.join("\n- "),
      "\nMANUAL STEPS (owner):\n- " + manualSteps.join("\n- "),
      "\nNot covered automatically yet: keyword position tracking (needs GSC API), page-speed impact (see Vercel Speed Insights).",
    ].join("\n"),
    context: "Deterministic own-site audit: sitemap, robots, JSON-LD, brand variations, meta/OG, sampled link health.",
    status: findings.length ? "pending" : "acknowledged",
    platform: "site",
    target: "swiftcard.me",
  });
  // Closed loop: a clean report files itself (zero owner clicks on quiet
  // days); a report WITH findings stays pending and hands itself to the Fixer
  // workflow via GitHub step outputs.
  try {
    const { appendFileSync } = await import("node:fs");
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `findings=${findings.length}\nitem_id=${item?.id ?? ""}\n`);
  } catch { /* not running in Actions */ }
  await run.finish(findings.length ? "success" : "success", `${findings.length} finding(s), ${ok.length} checks healthy. $0.00 spent (no LLM).`);
});
