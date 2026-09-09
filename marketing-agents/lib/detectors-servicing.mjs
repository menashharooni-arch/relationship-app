// ── Rex's servicing bench — nine more code-only watchdogs (2026-09-08) ──────
//
// Same contract as lib/detectors.mjs: every detector is a plain async function
// that returns an array of findings `{ key, title, detail, severity }`, spends
// ZERO tokens, and never throws. The watchdog loop dedupes on `key`, wakes the
// agent on a NEW finding, and closes the item when the key stops appearing.
//
// Two things are different from the original four, because these watch a
// POPULATION (every card, every link) rather than a fixed list:
//
//   1. Each pass checks a rotating SAMPLE, so one card page failing is found
//      within the hour without hammering the site on every tick. The loop
//      passes `{ openKeys }` — anything currently open is re-checked EVERY
//      pass, so a finding only closes when the thing it describes is actually
//      fixed, never because the sample moved on.
//   2. Each has its own cadence (INTERVAL_MIN in watchdog.mjs) — a dependency
//      audit twice a day, a card sweep every 20 minutes.
//
// Detection stays code-only: not one of these reads an LLM. The test pins it.
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import tls from "node:tls";
import { BASE, probe, stable, sbRows, sbCount, isoAgo, HOUR, DAY } from "./probe.mjs";

const execFileP = promisify(execFile);
const APP_ID = "6798875872"; // SwiftCard: Business Card — App Store id
const SITE_HOST = new URL(BASE).host;

/** React escapes quotes and apostrophes in names; compare against the decoded page. */
function decodeEntities(html) {
  return html.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x2F;/g, "/");
}

/** Deterministic rotating sample: which slice of `list` this pass looks at. */
function rotate(list, n, periodMs) {
  if (!list.length) return [];
  const slot = Math.floor(Date.now() / periodMs);
  const out = [];
  const take = Math.min(n, list.length);
  for (let i = 0; i < take; i++) out.push(list[(slot * take + i) % list.length]);
  return out;
}

// ── Cara · Card health ───────────────────────────────────────────────────────
// The product IS the card page. Finn checks one known card; Cara walks the
// real population: page renders the owner's name, the vCard downloads, the
// logo/photo the owner uploaded still resolves, the /links page loads.
export async function caraCardCheck({ openKeys = [] } = {}) {
  const rows = await sbRows("cards", "select=username,name,logo_url,is_offline,created_at&is_offline=eq.false&order=created_at.desc&limit=400");
  if (rows === null) return []; // blindness reports the table being unreachable
  const live = rows.filter((r) => r.username);
  if (!live.length) return [];

  const reopen = live.filter((c) => openKeys.some((k) => k.startsWith(`watchdog:card:${c.username}:`)));
  const sample = [...new Map([...reopen, ...rotate(live, 6, 20 * 60 * 1000)].map((c) => [c.username, c])).values()];

  const findings = [];
  let pageFail = 0, vcardFail = 0;
  for (const c of sample) {
    const slug = encodeURIComponent(String(c.username).toLowerCase());
    const page = await stable(() => probe(`/${slug}`, { wantBody: true }), 2);
    const firstName = String(c.name ?? "").trim().split(/\s+/)[0] ?? "";
    if (!page.ok) {
      pageFail++;
      findings.push({
        key: `card:${c.username}:page`,
        title: `Card page /${c.username} is down (HTTP ${page.status || "no response"})`,
        detail: `Two consecutive loads of ${BASE}/${slug} failed with status ${page.status || "none"}${page.err ? ` (${page.err})` : ""}. Anyone tapping this person's NFC card or QR code right now sees an error.`,
        severity: "critical",
      });
    } else if (firstName.length >= 2 && !decodeEntities(page.body).includes(firstName)) {
      findings.push({
        key: `card:${c.username}:empty`,
        title: `Card page /${c.username} loads but does not show the owner's name`,
        detail: `${BASE}/${slug} returned 200 but the HTML never mentions "${firstName}" (the card's saved name). That is the soft-404 shape: a generic shell instead of the card. Open it in a browser to confirm.`,
        severity: "warn",
      });
    }

    const vc = await stable(() => probe(`/api/card/${slug}/vcard`, { wantBody: true }), 2);
    if (!vc.ok || !vc.body.includes("BEGIN:VCARD")) {
      vcardFail++;
      findings.push({
        key: `card:${c.username}:vcard`,
        title: `"Save contact" is broken for /${c.username} (vCard ${vc.status || "no response"})`,
        detail: `${BASE}/api/card/${slug}/vcard ${vc.ok ? "returned 200 without BEGIN:VCARD" : `failed with status ${vc.status || "none"}`}. The Save-contact button on this card downloads nothing usable.`,
        severity: "critical",
      });
    }

    if (c.logo_url && /^https?:\/\//.test(c.logo_url)) {
      const img = await stable(() => probe(c.logo_url, { timeoutMs: 10000 }), 2);
      if (!img.ok) {
        findings.push({
          key: `card:${c.username}:logo`,
          title: `Logo image missing on /${c.username} (HTTP ${img.status || "no response"})`,
          detail: `The logo this card points at (${c.logo_url.slice(0, 160)}) no longer loads — status ${img.status || "none"}. The card renders with a broken image where the company logo should be.`,
          severity: "warn",
        });
      }
    }
  }

  // A cluster of failures is one systemic outage, not N card problems.
  const n = sample.length;
  if (n >= 3 && (pageFail / n >= 0.5 || vcardFail / n >= 0.5)) {
    return [{
      key: "card:systemic",
      title: `Card pages are failing across the board (${pageFail} of ${n} pages, ${vcardFail} of ${n} vCards)`,
      detail: `A rotating sample of ${n} live cards had ${pageFail} page failures and ${vcardFail} vCard failures in one pass. This is the site or the database, not one card — check ${BASE}/api/health and the latest deploy first.`,
      severity: "critical",
    }];
  }
  return findings;
}

// ── Lyn · Links ──────────────────────────────────────────────────────────────
// Every link the marketing site publishes, plus the machinery Google reads
// (sitemap, robots, canonical/noindex) and the referral redirect.
const LINK_SKIP = /^(mailto:|tel:|sms:|javascript:|#|data:)/i;
const EXTERNAL_OK = new Set([401, 403, 405, 429, 999]); // bot walls are not broken links

function extractLinks(html, fromPath) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*?\bhref="([^"#]+)(?:#[^"]*)?"/gi)) {
    const href = m[1].trim();
    if (!href || LINK_SKIP.test(href)) continue;
    if (href.startsWith("//")) { out.push({ url: "https:" + href, from: fromPath }); continue; }
    if (href.startsWith("/")) { out.push({ url: BASE + href, from: fromPath }); continue; }
    if (/^https?:\/\//i.test(href)) out.push({ url: href, from: fromPath });
  }
  return out;
}

async function sitemapUrls() {
  const sm = await stable(() => probe("/sitemap.xml", { wantBody: true }), 2);
  const locs = [...sm.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  return { sm, locs };
}

export async function lynLinkCheck({ openKeys = [] } = {}) {
  const findings = [];
  const { sm, locs } = await sitemapUrls();
  if (!sm.ok || !sm.body.includes("<urlset")) {
    findings.push({ key: "link:sitemap", title: `sitemap.xml is broken (HTTP ${sm.status || "no response"})`, detail: `${BASE}/sitemap.xml did not return a valid <urlset>. Google uses this to discover every page — a broken sitemap slowly de-indexes the site.`, severity: "critical" });
  } else {
    const foreign = locs.filter((u) => { try { return new URL(u).host !== SITE_HOST; } catch { return true; } });
    if (locs.length < 10) findings.push({ key: "link:sitemap:thin", title: `sitemap.xml lists only ${locs.length} pages`, detail: `Expected dozens of marketing, compare, industry and card pages; got ${locs.length}. Something is filtering pages out of the sitemap.`, severity: "warn" });
    if (foreign.length) findings.push({ key: "link:sitemap:foreign", title: `sitemap.xml lists ${foreign.length} URLs on the wrong host`, detail: `e.g. ${foreign[0]} — every sitemap URL must be on ${SITE_HOST}. Usually NEXT_PUBLIC_APP_URL is pointing at a preview domain.`, severity: "warn" });
  }
  const robots = await stable(() => probe("/robots.txt", { wantBody: true }), 2);
  if (!robots.ok || !/sitemap:/i.test(robots.body)) {
    findings.push({ key: "link:robots", title: `robots.txt is ${robots.ok ? "missing its Sitemap line" : `down (HTTP ${robots.status || "no response"})`}`, detail: `${BASE}/robots.txt must load and point crawlers at the sitemap. Body starts: ${robots.body.slice(0, 120)}`, severity: "warn" });
  } else if (/^\s*disallow:\s*\/\s*$/im.test(robots.body)) {
    findings.push({ key: "link:robots:blocked", title: "robots.txt is blocking the whole site", detail: `A blanket "Disallow: /" is live in ${BASE}/robots.txt. Every crawler will stop indexing the site.`, severity: "critical" });
  }

  // Key pages must stay indexable.
  for (const path of ["/", "/pricing"]) {
    const r = await stable(() => probe(path, { wantBody: true }), 2);
    if (r.ok && /<meta[^>]+name="robots"[^>]+noindex/i.test(r.body)) {
      findings.push({ key: `link:noindex:${path}`, title: `${path} is marked noindex`, detail: `${BASE}${path} carries a robots noindex meta tag. Google will drop it from search results.`, severity: "critical" });
    }
  }

  // Crawl: home + a rotating slice of sitemap pages, then check the links
  // they contain. Internal first, a small external sample, and everything
  // currently open so a fix is noticed on the next pass.
  const marketingPages = locs.map((u) => { try { return new URL(u).pathname; } catch { return null; } }).filter((p) => p && p !== "/");
  const sources = ["/", ...rotate(marketingPages, 7, 4 * HOUR)];
  const found = new Map();
  for (const path of sources) {
    const r = await probe(path, { wantBody: true });
    if (!r.ok) continue;
    for (const l of extractLinks(r.body, path)) if (!found.has(l.url)) found.set(l.url, l);
  }
  const all = [...found.values()];
  const internal = all.filter((l) => { try { return new URL(l.url).host === SITE_HOST && !/^\/(_next|api)\//.test(new URL(l.url).pathname); } catch { return false; } });
  const external = all.filter((l) => { try { return new URL(l.url).host !== SITE_HOST; } catch { return false; } });
  const reopen = openKeys.filter((k) => k.startsWith("watchdog:link:http")).map((k) => ({ url: k.slice("watchdog:link:".length), from: "(previously reported)" }));
  const toCheck = [...new Map([...reopen, ...internal.slice(0, 60), ...rotate(external, 20, 4 * HOUR)].map((l) => [l.url, l])).values()];

  let internalBroken = 0;
  for (const l of toCheck) {
    const isInternal = (() => { try { return new URL(l.url).host === SITE_HOST; } catch { return false; } })();
    let r = await probe(l.url, { method: isInternal ? "GET" : "HEAD", timeoutMs: 12000 });
    if (!r.ok && !isInternal) r = await probe(l.url, { method: "GET", timeoutMs: 12000 });
    if (!r.ok && r.status !== 0) r = await stable(() => probe(l.url, { method: "GET", timeoutMs: 12000 }), 2);
    const broken = isInternal ? (!r.ok) : (r.status === 0 || r.status === 404 || r.status === 410 || r.status >= 500) && !EXTERNAL_OK.has(r.status);
    if (!broken) continue;
    if (isInternal) internalBroken++;
    findings.push({
      key: `link:${l.url}`,
      title: `${isInternal ? "Dead page" : "Dead outbound link"}: ${l.url.replace(BASE, "")} (HTTP ${r.status || "no response"})`,
      detail: `Linked from ${l.from}. ${l.url} returns ${r.status || "no response"}${r.err ? ` (${r.err})` : ""}. ${isInternal ? "A visitor clicking it hits an error page on our own site." : "Either update the link or remove it."}`,
      severity: isInternal ? "warn" : "warn",
    });
  }
  if (internalBroken >= 5) {
    findings.push({ key: "link:systemic", title: `${internalBroken} internal links are dead at once`, detail: "Five or more of the site's own links fail in one pass — that is a routing or deploy regression, not a stray typo. Check the latest deploy.", severity: "critical" });
  }

  // The referral link a customer shares must still land on signup.
  const refs = await sbRows("profiles", "select=referral_code&referral_code=not.is.null&limit=1");
  const code = refs?.[0]?.referral_code;
  if (code) {
    const r = await stable(() => probe(`/r/${encodeURIComponent(code)}`), 2);
    const landed = (() => { try { return new URL(r.url || ""); } catch { return null; } })();
    // Signup is a tab on /login (?mode=signup), not its own path — so ask
    // "did this land on the signup form", not "is 'signup' in the pathname".
    // The path-only test failed on the real, working destination.
    const onSignup = landed && (/signup/.test(landed.pathname) || landed.searchParams.get("mode") === "signup");
    if (!r.ok || !landed || landed.host !== SITE_HOST || !onSignup) {
      findings.push({ key: "link:referral", title: `Referral links (/r/CODE) no longer land on signup (HTTP ${r.status || "no response"})`, detail: `${BASE}/r/${code} ended at ${r.url || "nowhere"} with status ${r.status || "none"}. Every "give a friend a free month" link customers have shared is affected.`, severity: "critical" });
    }
  }
  return findings;
}

// ── Penny · Payments ─────────────────────────────────────────────────────────
// Reads the Stripe webhook mirror (stripe_events) and the plan columns — no
// Stripe key needed for the core watch. Silence, failures, disputes, drift.
export async function pennyPaymentCheck() {
  const findings = [];
  const events = await sbRows("stripe_events", `select=event_id,type,created_at&created_at=gte.${isoAgo(7 * DAY)}&order=created_at.desc&limit=500`);
  if (events === null) return [];
  const day = events.filter((e) => new Date(e.created_at).getTime() >= Date.now() - DAY);
  const today = new Date().toISOString().slice(0, 10);

  const failed = day.filter((e) => /invoice\.payment_failed|charge\.failed|payment_intent\.payment_failed/.test(e.type));
  if (failed.length) findings.push({
    key: `pay:failed:${today}`,
    title: `${failed.length} failed payment${failed.length > 1 ? "s" : ""} in the last 24 hours`,
    detail: `Stripe reported ${failed.length} failed charge/invoice event(s) today (latest ${failed[0].created_at}). Stripe retries on its own schedule; if the same customer fails three times the subscription lapses. Check Stripe → Payments → Failed.`,
    severity: failed.length >= 3 ? "critical" : "warn",
  });
  for (const e of events.filter((e) => /charge\.dispute\.created|dispute/.test(e.type))) {
    findings.push({ key: `pay:dispute:${e.event_id}`, title: "A customer opened a chargeback", detail: `Stripe event ${e.event_id} (${e.type}) at ${e.created_at}. Disputes have a response deadline and a $15 fee — answer it in Stripe → Disputes within the week.`, severity: "critical" });
  }
  const cancels = day.filter((e) => e.type === "customer.subscription.deleted");
  if (cancels.length >= 3) findings.push({ key: `pay:cancels:${today}`, title: `${cancels.length} subscriptions canceled in 24 hours`, detail: `That is a spike for our size. Look for a shared cause — a broken feature, a price change, a bad email — before it becomes a trend. Cass (churn) will get the list on her next shift.`, severity: "warn" });

  // Webhook silence with paying customers is usually a broken signing secret.
  const pro = await sbCount("profiles", "plan=eq.pro&stripe_subscription_id=not.is.null");
  const last = (await sbRows("stripe_events", "select=created_at&order=created_at.desc&limit=1"))?.[0]?.created_at;
  if ((pro ?? 0) >= 3 && last && Date.now() - new Date(last).getTime() > 35 * DAY) {
    findings.push({ key: "pay:webhook-silent", title: `No Stripe webhook has arrived in ${Math.floor((Date.now() - new Date(last).getTime()) / DAY)} days`, detail: `${pro} customers are on paid monthly plans, so renewals must be firing — yet the last stored event is ${last}. Most likely the webhook signing secret changed or the endpoint is disabled in Stripe → Developers → Webhooks.`, severity: "critical" });
  }

  // The endpoint itself: an unsigned POST must be REFUSED with a 4xx. A 200
  // means signature checks are off; a 5xx means the handler crashes on input.
  const wh = await probe("/api/stripe/webhook", { method: "POST", timeoutMs: 10000 });
  if (wh.status === 200 || wh.status >= 500 || wh.status === 404 || wh.status === 0) {
    findings.push({ key: "pay:webhook-endpoint", title: `Stripe webhook endpoint answered ${wh.status || "nothing"} to an unsigned POST`, detail: `${BASE}/api/stripe/webhook should reject an unsigned request with 400. ${wh.status === 200 ? "It ACCEPTED it — signature verification is off, anyone can fake a payment event." : wh.status === 404 || wh.status === 0 ? "It is unreachable — Stripe cannot tell us about payments." : "It crashed — real Stripe events are probably failing too (check Stripe → Webhooks → attempts)."}`, severity: "critical" });
  }

  // Entitlement drift: still marked Pro long after the plan's own expiry.
  const drift = await sbCount("profiles", `plan=eq.pro&plan_expires_at=lt.${isoAgo(3 * DAY)}`);
  if (drift) findings.push({ key: "pay:drift:expired-pro", title: `${drift} account${drift > 1 ? "s" : ""} still Pro 3+ days past their expiry date`, detail: `profiles.plan is "pro" but plan_expires_at passed more than three days ago. Either the renewal webhook/IAP sync did not update the date (customer paid — harmless) or the downgrade never ran (customer on Pro for free). Check Stripe/App Store for each before touching anything.`, severity: "warn" });
  return findings;
}

// ── Della · Deliverability ───────────────────────────────────────────────────
export async function dellaDeliveryCheck() {
  const findings = [];
  const logs = await sbRows("email_logs", `select=type,status,error,created_at&created_at=gte.${isoAgo(DAY)}&limit=2000`);
  if (logs === null) return [];
  const attempts = logs.filter((l) => l.status !== "skipped");
  const failed = attempts.filter((l) => /fail|bounce|complain|error|reject/i.test(String(l.status)));
  if (attempts.length >= 10) {
    const rate = failed.length / attempts.length;
    if (rate >= 0.2) {
      const sample = failed.find((f) => f.error)?.error ?? "(no error text)";
      findings.push({ key: "mail:failure-rate", title: `${Math.round(rate * 100)}% of emails failed in the last 24 hours (${failed.length} of ${attempts.length})`, detail: `Sample error: ${String(sample).slice(0, 200)}. Over 20% is a provider problem (Resend key, domain verification, a suspended sending domain), not individual bad addresses.`, severity: rate >= 0.5 ? "critical" : "warn" });
    }
  }
  // Welcome email is the one every new person must get.
  const signups = await sbCount("profiles", `created_at=gte.${isoAgo(DAY)}`);
  const welcomes = logs.filter((l) => l.type === "welcome" && l.status === "sent").length;
  if ((signups ?? 0) >= 2 && welcomes === 0) {
    findings.push({ key: "mail:welcome-silent", title: `${signups} people signed up today and none got a welcome email`, detail: "email_logs shows no sent welcome email in 24 hours while profiles gained new rows. The welcome sender is failing or disabled — new customers are starting cold.", severity: "warn" });
  }
  // Push: only readable once push-log.sql is applied (blindness covers the gap).
  const pushes = await sbRows("push_log", `select=outcome&created_at=gte.${isoAgo(DAY)}&limit=2000`);
  if (pushes) {
    const tried = pushes.filter((p) => p.outcome === "sent" || p.outcome === "failed");
    const bad = tried.filter((p) => p.outcome === "failed").length;
    if (tried.length >= 5 && bad / tried.length >= 0.5) {
      findings.push({ key: "push:failure-rate", title: `${bad} of ${tried.length} push notifications failed today`, detail: "Half or more of the view-alert pushes could not be delivered. Usually an APNs key/certificate problem or expired VAPID keys — the phone stays silent while the card is being viewed.", severity: "warn" });
    }
  }
  // The unsubscribe link must always work — a dead one is a CAN-SPAM problem.
  const unsub = await stable(() => probe("/unsubscribe"), 2);
  if (unsub.status >= 500 || unsub.status === 0) {
    findings.push({ key: "mail:unsubscribe-down", title: `The unsubscribe page is down (HTTP ${unsub.status || "no response"})`, detail: `${BASE}/unsubscribe must load for every email we send — it is a legal requirement, and a dead one drives spam complaints.`, severity: "critical" });
  }
  return findings;
}

// ── Ren · Renewals ───────────────────────────────────────────────────────────
// Things that expire on a calendar and take the whole product down when they
// do: the domain, the TLS certificate, and the dated secrets listed in
// marketing-agents/renewals.json (Apple's 6-month Sign-in secret, etc.).
function daysUntil(iso) { return Math.floor((new Date(iso).getTime() - Date.now()) / DAY); }
function renewalFinding(key, label, dueIso, fix) {
  const d = daysUntil(dueIso);
  if (Number.isNaN(d) || d > 30) return null;
  return {
    key: `renew:${key}`,
    title: d < 0 ? `${label} EXPIRED ${-d} day${-d === 1 ? "" : "s"} ago` : `${label} expires in ${d} day${d === 1 ? "" : "s"} (${String(dueIso).slice(0, 10)})`,
    detail: `${fix} Nothing else in the system can renew this — it is the owner's to do.`,
    severity: d <= 7 ? "critical" : "warn",
  };
}

async function domainExpiry(host) {
  const r = await probe(`https://rdap.org/domain/${host}`, { wantBody: true, timeoutMs: 15000, headers: { accept: "application/rdap+json" } });
  if (!r.ok) return null;
  try {
    const ev = (JSON.parse(r.body).events ?? []).find((e) => /expiration/i.test(e.eventAction));
    return ev?.eventDate ?? null;
  } catch { return null; }
}

function certExpiry(host) {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 10000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      resolve(c?.valid_to ? new Date(c.valid_to).toISOString() : null);
    });
    s.on("error", () => resolve(null));
    s.on("timeout", () => { s.destroy(); resolve(null); });
  });
}

export function loadRenewals() {
  try { return JSON.parse(readFileSync(new URL("../renewals.json", import.meta.url), "utf8")); } catch { return []; }
}

export async function renRenewalCheck() {
  const findings = [];
  const dom = await domainExpiry(SITE_HOST);
  if (dom) { const f = renewalFinding("domain", `The domain ${SITE_HOST}`, dom, "Renew it at the registrar (Namecheap) — if it lapses every card link, email and the app's API go dark at once."); if (f) findings.push(f); }
  const cert = await certExpiry(SITE_HOST);
  if (cert) { const f = renewalFinding("tls", "The site's HTTPS certificate", cert, "Vercel renews this automatically; if it is under 14 days out, auto-renewal is failing — check the domain in Vercel → Settings → Domains."); if (f && daysUntil(cert) <= 14) findings.push(f); }
  for (const r of loadRenewals()) {
    if (!r?.key || !r?.label) continue;
    if (!r.due) {
      findings.push({ key: `renew:unknown:${r.key}`, title: `Renewal date unknown: ${r.label}`, detail: `${r.note ?? ""} Add a "due" date (YYYY-MM-DD) for "${r.key}" in marketing-agents/renewals.json so Ren can warn 30 and 7 days ahead.`.trim(), severity: "warn" });
      continue;
    }
    const f = renewalFinding(r.key, r.label, r.due, r.fix ?? "Renew it before the date.");
    if (f) findings.push(f);
  }
  return findings;
}

// ── Dex · Dependencies ───────────────────────────────────────────────────────
export async function dexDepsCheck() {
  const cwd = process.env.GITHUB_WORKSPACE || process.cwd();
  let out;
  try {
    ({ stdout: out } = await execFileP("npm", ["audit", "--package-lock-only", "--omit=dev", "--json"], { cwd, timeout: 120000, maxBuffer: 16 * 1024 * 1024 }));
  } catch (e) {
    out = e?.stdout; // npm exits 1 when it finds anything — the JSON is still on stdout
    if (!out) return [];
  }
  let report;
  try { report = JSON.parse(out); } catch { return []; }
  const vulns = report?.vulnerabilities ?? {};
  const findings = [];
  for (const [name, v] of Object.entries(vulns)) {
    if (!["high", "critical"].includes(v.severity)) continue;
    const via = (v.via ?? []).map((x) => (typeof x === "string" ? x : x.title)).filter(Boolean).slice(0, 2).join("; ");
    const fix = v.fixAvailable === true ? "npm audit fix resolves it." : v.fixAvailable?.name ? `Fix: upgrade ${v.fixAvailable.name} to ${v.fixAvailable.version}${v.fixAvailable.isSemVerMajor ? " (major — needs a test run)" : ""}.` : "No published fix yet — watch the advisory.";
    findings.push({
      key: `deps:${name}:${v.severity}`,
      title: `${v.severity === "critical" ? "Critical" : "High"} vulnerability in ${name} (${v.range ?? "installed"})`,
      detail: `${via || "See npm audit."} ${fix} Runtime dependency (not dev-only), so it ships to production.`,
      severity: v.severity === "critical" ? "critical" : "warn",
    });
  }
  return findings;
}

// ── Dana · Data integrity ────────────────────────────────────────────────────
// The silent failure class: the site is up, nothing errors, and nothing is
// being written. Compares each signal to its own recent baseline; on a small
// dataset the baseline gate means it says nothing rather than crying wolf.
const RLS_TABLES = ["profiles", "leads", "email_logs", "push_subscriptions", "card_views", "stripe_events"];

async function anonReads(table) {
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return null; }
}

export async function danaDataCheck() {
  const findings = [];
  const recent = await sbCount("card_views", `viewed_at=gte.${isoAgo(6 * HOUR)}`);
  const base = await sbCount("card_views", `viewed_at=gte.${isoAgo(14 * DAY)}&viewed_at=lt.${isoAgo(6 * HOUR)}`);
  if (recent !== null && base !== null) {
    const perWindow = base / ((14 * DAY - 6 * HOUR) / (6 * HOUR));
    if (perWindow >= 5 && recent === 0) {
      findings.push({ key: "data:views-silent", title: "No card view has been recorded in 6 hours", detail: `The two-week average is ${perWindow.toFixed(1)} views per 6-hour window; the last 6 hours logged zero. Card pages may be loading without the view tracker writing (a broken insert, an RLS change, a client error). Open a card in an incognito window and check card_views.`, severity: "critical" });
    }
  }
  const newSignups = await sbCount("profiles", `created_at=gte.${isoAgo(3 * DAY)}`);
  const baseSignups = await sbCount("profiles", `created_at=gte.${isoAgo(17 * DAY)}&created_at=lt.${isoAgo(3 * DAY)}`);
  if (newSignups !== null && baseSignups !== null && baseSignups / 14 >= 1 && newSignups === 0) {
    findings.push({ key: "data:signups-silent", title: "No signup in 3 days against a baseline of 1+ per day", detail: `${baseSignups} accounts were created in the prior two weeks and none in the last three days. Either marketing stopped, or the signup form/OAuth is failing after the page loads. Finn only sees the page render — try a real signup.`, severity: "warn" });
  }
  // Orphans: a card whose owner no longer exists (a purge that half-ran).
  const cards = await sbRows("cards", "select=user_id&limit=1000");
  const profiles = await sbRows("profiles", "select=id&limit=1000");
  if (cards && profiles && cards.length < 1000 && profiles.length < 1000) {
    const ids = new Set(profiles.map((p) => p.id));
    const orphans = cards.filter((c) => c.user_id && !ids.has(c.user_id)).length;
    if (orphans) findings.push({ key: "data:orphan-cards", title: `${orphans} card${orphans > 1 ? "s" : ""} belong to accounts that no longer exist`, detail: "cards.user_id points at a profile that is gone. Usually an account purge that deleted the profile but not the cards — the pages may still be live under a deleted person's name.", severity: "warn" });
  }
  // Row-level security: the public anon key must not read private tables.
  for (const t of RLS_TABLES) {
    const leaks = await anonReads(t);
    if (leaks === true) findings.push({ key: `data:rls:${t}`, title: `The public anon key can read the ${t} table`, detail: `A request with only the browser-visible anon key returned rows from ${t}. Row-level security is off or a policy is too broad — anyone can pull this data. Fix the policy in Supabase → Authentication → Policies immediately.`, severity: "critical" });
  }
  return findings;
}

// ── Ash · App Store ──────────────────────────────────────────────────────────
export async function ashAppStoreCheck() {
  const findings = [];
  const look = await stable(() => probe(`https://itunes.apple.com/lookup?id=${APP_ID}&country=us`, { wantBody: true }), 2);
  if (look.ok) {
    let d = null;
    try { d = JSON.parse(look.body); } catch { d = null; }
    if (d && d.resultCount === 0) {
      findings.push({ key: "app:missing", title: "SwiftCard is no longer listed on the App Store", detail: `The App Store lookup for id ${APP_ID} returns no results. Either the app was removed from sale or Apple pulled it — check App Store Connect → App Status right away.`, severity: "critical" });
    } else if (d?.results?.[0]) {
      const a = d.results[0];
      const count = Number(a.userRatingCount ?? 0), rating = Number(a.averageUserRating ?? 0);
      if (count >= 5 && rating < 3.5) findings.push({ key: "app:rating-low", title: `App Store rating fell to ${rating.toFixed(1)}★ (${count} ratings)`, detail: "Below 3.5 the listing converts badly and Apple demotes it in search. Sam (reviews) should read every recent review and the in-app Rate-us gate needs a look.", severity: "warn" });
    }
  }
  const rss = await stable(() => probe(`https://itunes.apple.com/us/rss/customerreviews/id=${APP_ID}/sortBy=mostRecent/json`, { wantBody: true }), 2);
  if (rss.ok) {
    let entries = [];
    try { const e = JSON.parse(rss.body)?.feed?.entry; entries = Array.isArray(e) ? e : e ? [e] : []; } catch { entries = []; }
    for (const e of entries) {
      const stars = Number(e?.["im:rating"]?.label ?? 5);
      const when = new Date(e?.updated?.label ?? 0).getTime();
      if (stars > 2 || Date.now() - when > 7 * DAY) continue;
      const id = e?.id?.label ?? String(when);
      findings.push({ key: `app:review:${id}`, title: `New ${stars}★ App Store review: "${String(e?.title?.label ?? "").slice(0, 80)}"`, detail: `${String(e?.author?.name?.label ?? "Someone")} wrote: ${String(e?.content?.label ?? "").slice(0, 400)}\n\nSam drafts the public reply; if it describes a bug, Bo/Fixer own the fix.`, severity: "warn" });
    }
  }
  return findings;
}

// ── Pix · Layout (the cheap, every-half-hour half) ───────────────────────────
// The daily deep pass (agent-layout.mjs) renders pages in a real browser. This
// tick-level check catches the one failure that makes every page look broken
// at once: the stylesheet not loading.
export async function pixLayoutCheck() {
  const home = await stable(() => probe("/", { wantBody: true }), 2);
  if (!home.ok) return []; // Finn owns "the site is down"
  const links = [...home.body.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/gi)].map((m) => m[1]);
  if (!links.length) {
    return [{ key: "layout:no-css", title: "The homepage HTML references no stylesheet", detail: "The rendered page has no <link rel=\"stylesheet\">. With Tailwind compiled into a CSS file this means the build shipped unstyled — every page renders as raw text.", severity: "critical" }];
  }
  // Next splits CSS into several chunks (one can legitimately be ~1.7KB), so
  // judge the SET: every chunk must answer as CSS, and together they must be
  // big enough to be the app's styling, not a fragment.
  let total = 0;
  for (const href of links.slice(0, 6)) {
    const css = await stable(() => probe(href, { wantBody: true, timeoutMs: 10000 }), 2);
    const type = css.headers.get("content-type") ?? "";
    if (!css.ok || !/css/.test(type)) {
      return [{ key: "layout:css-broken", title: `A site stylesheet does not load (HTTP ${css.status || "no response"}, ${type || "no type"})`, detail: `${href} is one of the files every page pulls its styling from and it returned ${css.status || "nothing"}. Visitors see a partly or fully unstyled page. Almost always a bad deploy or a CDN purge — redeploy.`, severity: "critical" }];
    }
    total += css.body.length;
  }
  if (total < 20000) {
    return [{ key: "layout:css-broken", title: `The site stylesheets are only ${total} bytes together`, detail: `${links.length} stylesheet(s) loaded but add up to ${total} bytes — far too little to be the compiled Tailwind. The build most likely shipped unstyled.`, severity: "critical" }];
  }
  return [];
}

export const SERVICING_DETECTORS = {
  cards: caraCardCheck,
  links: lynLinkCheck,
  payments: pennyPaymentCheck,
  deliverability: dellaDeliveryCheck,
  renewals: renRenewalCheck,
  deps: dexDepsCheck,
  data: danaDataCheck,
  appstore: ashAppStoreCheck,
  layout: pixLayoutCheck,
};

/** How often each detector runs, in minutes (the loop ticks every minute). */
export const SERVICING_INTERVAL_MIN = {
  cards: 20,
  links: 240,
  payments: 15,
  deliverability: 30,
  renewals: 360,
  deps: 720,
  data: 30,
  appstore: 60,
  layout: 30,
};

/** What each watchdog's findings are filed as (the queue's filters key on it). */
export const FINDING_ITEM_TYPE = {
  security: "security_finding", perf: "perf_finding", flowcheck: "flow_finding", bugwatch: "bug_finding",
  cards: "card_finding", links: "link_finding", payments: "payment_finding", deliverability: "delivery_finding",
  renewals: "renewal_finding", deps: "dependency_finding", data: "data_finding", appstore: "appstore_finding", layout: "layout_finding",
};

/** Watchdogs whose findings are code-fixable — the loop hands them to Fixer. */
export const FIXER_ELIGIBLE = new Set(["cards", "links", "layout", "deps", "flowcheck"]);

// ── Blindness for the new bench ──────────────────────────────────────────────
export const SERVICING_BLINDNESS = {
  cards: async () => (await sbRows("cards", "select=username&limit=1")) === null ? {
    key: "blind:cards:no-table", title: "Cara cannot see the cards table",
    detail: "The cards table did not answer with the agents' Supabase key. This is a CONFIGURATION gap, not a healthy silence: until it is fixed nobody is checking that card pages render. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the repository secrets.",
    severity: "warn",
  } : null,
  payments: async () => (await sbRows("stripe_events", "select=event_id&limit=1")) === null ? {
    key: "blind:payments:no-table", title: "Penny cannot see Stripe events",
    detail: "The stripe_events table did not answer. This is a CONFIGURATION gap: the webhook mirror is what Penny reads for failed payments, disputes and cancellations. Confirm the table exists and the agents' Supabase key can read it.",
    severity: "warn",
  } : null,
  deliverability: async () => {
    if ((await sbRows("email_logs", "select=id&limit=1")) === null) return {
      key: "blind:deliverability:no-email-logs", title: "Della cannot see the email log",
      detail: "The email_logs table did not answer. This is a CONFIGURATION gap: without it no one is watching whether welcome emails and receipts actually send.",
      severity: "warn",
    };
    if ((await sbRows("push_log", "select=id&limit=1")) === null) return {
      key: "blind:deliverability:no-push-log", title: "Della cannot see push notifications — push_log table is missing",
      detail: "Email is watched, but push delivery is not: the push_log table does not exist in production. This is a CONFIGURATION gap. Fix: run supabase/push-log.sql in the Supabase SQL editor; Della picks it up on the next pass.",
      severity: "warn",
    };
    return null;
  },
  data: async () => process.env.SUPABASE_ANON_KEY ? null : {
    key: "blind:data:no-anon-key", title: "Dana cannot test row-level security — SUPABASE_ANON_KEY is not set",
    detail: "Dana checks that the browser-visible anon key cannot read private tables (profiles, leads, email logs). Without the anon key in the repository secrets that check is skipped. This is a CONFIGURATION gap. Fix: add SUPABASE_ANON_KEY (the public anon key from Supabase → Settings → API) as a GitHub Actions secret.",
    severity: "warn",
  },
};
