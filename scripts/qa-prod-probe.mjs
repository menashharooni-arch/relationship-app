// node scripts/qa-prod-probe.mjs      env: BASE=<url> (default https://swiftcard.me)  OUT=<dir>
//
// The two pipelines the owner has had fixed more than once, exercised END TO
// END against production, with a throwaway account, every night and after
// every deploy (.github/workflows/nightly-qa.yml):
//
//   1. ANALYTICS  — a view recorded through the real endpoint lands as exactly
//      ONE card_views row, a reload inside the visit window adds none, and the
//      owner's dashboard shows it.
//   2. NOTIFICATIONS — a visit through the real card-events endpoint raises
//      exactly ONE notification carrying a visit_key; the same visitor coming
//      back inside the window raises none (the 2026-09 "double notification"
//      bug, pinned live).
//
// Plus the plumbing both depend on: bot traffic is still refused, and the
// endpoints answer fast. Everything it writes belongs to the throwaway
// account, which is deleted in `finally`.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const BASE = process.env.BASE || "https://swiftcard.me";
const OUT = process.env.OUT || "qa-prod-probe-out";
mkdirSync(OUT, { recursive: true });
const env = existsSync(`${ROOT}/.env.local`) ? readFileSync(`${ROOT}/.env.local`, "utf8") : "";
const g = (k) => process.env[k] ?? process.env[k.replace(/^NEXT_PUBLIC_/, "")] ?? (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const SB = g("NEXT_PUBLIC_SUPABASE_URL"), SVC = g("SUPABASE_SERVICE_ROLE_KEY");
if (!SB || !SVC) { console.error("missing SUPABASE url / service role key"); process.exit(2); }
const adm = (p, i) => fetch(SB + p, { ...i, headers: { apikey: SVC, Authorization: "Bearer " + SVC, "Content-Type": "application/json", ...(i?.headers ?? {}) } });

const UA_HUMAN = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const UA_BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const stamp = Date.now().toString().slice(-8);
const failures = [];
const pass = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) failures.push(m); };
const post = (path, body, ua = UA_HUMAN) => fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": ua }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
const timed = async (fn) => { const t0 = Date.now(); const r = await fn(); return [r, Date.now() - t0]; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let userId = null; const uname = `qa-probe-${stamp}`;
try {
  // ── seed one throwaway owner with one card ───────────────────────────────
  const email = `qa-probe-${stamp}@swiftcard-test.invalid`;
  const u = await (await adm("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password: `Qa!aA1${stamp}x`, email_confirm: true }) })).json();
  if (!u.id) throw new Error("seed user failed: " + JSON.stringify(u).slice(0, 160));
  userId = u.id;
  await adm("/rest/v1/profiles", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ id: userId, username: uname, name: "Probe Owner", email, plan: "free", customization: { _aiConsent: "accepted" } }) });
  await adm("/rest/v1/cards", { method: "POST", body: JSON.stringify({ user_id: userId, username: uname, name: "Probe Owner", title: "QA", company: "Probe Co", email, template: "classic-pro" }) });
  // The public page must exist before anything can be recorded against it.
  const page = await fetch(`${BASE}/${uname}`, { headers: { "User-Agent": UA_HUMAN }, signal: AbortSignal.timeout(20000) });
  pass(page.status === 200, `throwaway card page renders (${page.status})`);

  // ── 1. analytics: one view, deduped on reload, visible on the dashboard ──
  const visitor = `qa-probe-visitor-${stamp}`;
  const [v1, v1ms] = await timed(() => post(`/api/views/${uname}`, { visitorId: visitor, source: "direct" }));
  const [v2] = await timed(() => post(`/api/views/${uname}`, { visitorId: visitor, source: "direct" }));
  pass(v1.status < 300 && v2.status < 300, `view endpoint accepts a human visitor (${v1.status}, ${v2.status})`);
  // Beacons are fire-and-forget from the card page (nothing a visitor waits on),
  // and each spends ~2-4s in serial database round-trips (measured 2026-09-11:
  // views 1.8-3.3s, card-events 4-5.4s). The budget is set to catch a
  // REGRESSION from that baseline, not to flap on it. The measured number is
  // printed every night so a trend is visible in the run log.
  pass(v1ms < 6000, `view endpoint answers within budget (${v1ms}ms, budget 6000)`);
  await wait(1500);
  const views = await (await adm(`/rest/v1/card_views?username=eq.${uname}&select=id,visitor_id,source`)).json();
  pass(Array.isArray(views) && views.length === 1, `exactly ONE card_views row after view + reload (got ${Array.isArray(views) ? views.length : JSON.stringify(views).slice(0, 80)})`);
  const bot = await post(`/api/views/${uname}`, { visitorId: `bot-${stamp}`, source: "direct" }, UA_BOT);
  await wait(800);
  const viewsAfterBot = await (await adm(`/rest/v1/card_views?username=eq.${uname}&select=id`)).json();
  pass(viewsAfterBot.length === 1, `a crawler's view is refused (${bot.status}, rows still ${viewsAfterBot.length})`);

  // ── 2. notifications: one per visitor per visit, never two ───────────────
  // A fresh visitor: the analytics visitor above already opened a visit, so an
  // event from it is a legitimate "same visit" dedupe, not a notification.
  const ev = { card_owner_username: uname, event_type: "viewed_card", visitor_id: `-n` };
  const [e1, e1ms] = await timed(() => post("/api/card-events", ev));
  const [e2] = await timed(() => post("/api/card-events", ev));
  pass(e1.status < 300 && e2.status < 300, `card-events endpoint accepts a human visit (${e1.status}, ${e2.status})`);
  pass(e1ms < 8000, `card-events answers within budget (${e1ms}ms, budget 8000)`);
  await wait(2500);
  const notes = await (await adm(`/rest/v1/notifications?user_id=eq.${userId}&select=id,type,visit_key`)).json();
  const n = Array.isArray(notes) ? notes.length : -1;
  pass(n === 1, `exactly ONE notification for the visit (got ${n}: ${JSON.stringify(notes).slice(0, 120)})`);
  pass(n === 1 && !!notes[0].visit_key, `the notification carries a visit_key (dedupe index in force)`);

  // ── 3. the pipeline's own health endpoint ────────────────────────────────
  const [h, hms] = await timed(() => fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(20000) }));
  const hj = await h.json().catch(() => ({}));
  pass(h.status === 200 && hj.ok === true, `/api/health ok (db=${hj.db}, dbMs=${hj.dbMs}, ${hms}ms)`);
  pass(Number(hj.dbMs) < 1200, `database answers within budget (dbMs=${hj.dbMs})`);
} catch (e) {
  console.log("ERROR", e.message); failures.push("probe threw: " + e.message);
} finally {
  if (userId) {
    for (const p of [`/rest/v1/notifications?user_id=eq.${userId}`, `/rest/v1/card_events?card_owner_username=eq.${uname}`, `/rest/v1/card_views?username=eq.${uname}`, `/rest/v1/leads?card_owner=eq.${uname}`, `/rest/v1/cards?user_id=eq.${userId}`, `/rest/v1/profiles?id=eq.${userId}`]) {
      await adm(p, { method: "DELETE" }).catch(() => {});
    }
    await adm(`/auth/v1/admin/users/${userId}`, { method: "DELETE" }).catch(() => {});
  }
  writeFileSync(`${OUT}/failures.json`, JSON.stringify(failures, null, 2));
  console.log(failures.length ? `\n${failures.length} FAILURES` : "\nALL PASS");
  process.exit(failures.length ? 1 : 0);
}
