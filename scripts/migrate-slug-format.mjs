// One-time migration (owner order 2026-08-26): every AUTO-GENERATED card slug
// moves to the fused FirstLast-Company format. Hand-customized slugs are left
// alone (we only rename slugs that exactly match what the old auto-generator
// would have produced, incl. its -N dedupe suffixes). Each rename runs through
// the rename_card_slug RPC (atomic migration of views/__links/events/leads/
// analytics/notifications), then copies the share+signature images to the new
// slug (keeping the old files so installed email signatures keep rendering),
// and records the old slug in customization._prevSlugs so the public routes
// 308-redirect old links.
//   node --env-file=.env.local scripts/migrate-slug-format.mjs         (dry run)
//   node --env-file=.env.local scripts/migrate-slug-format.mjs --run   (execute)
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const RUN = process.argv.includes("--run");

// Mirrors src/lib/slug.ts exactly — keep in sync.
const normalizeSlug = (raw) => String(raw ?? "").toLowerCase().trim()
  .replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
const fuseWords = (part) => String(part ?? "").trim().split(/[^a-zA-Z0-9]+/).filter(Boolean)
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
const cardSlug = (name, company) => {
  const n = fuseWords(name), c = fuseWords(company ?? "");
  return normalizeSlug(c ? `${n}-${c}` : n);
};
const RESERVED = new Set(["account-deleted","admin","api","auth","card","cards","checkout","company","compare","contact","for","contacts","dashboard","grow","join","links","login","office","onboarding","preview","pricing","privacy","products","profile","r","settings","share","sms-consent","sms-terms","templates","terms","testimonials","unsubscribe","upgrade","welcome","favicon","robots","sitemap","manifest","icon","apple-icon","opengraph-image","_next","well-known","about","app","blog","docs","help","home","index","jobs","legal","logout","new","news","partners","press","signin","signup","signout","static","status","support","team"]);

const { data: cards, error } = await admin.from("cards").select("id, user_id, username, name, company, customization");
if (error) { console.error(error.message); process.exit(1); }
const { data: profiles } = await admin.from("profiles").select("username");
const taken = new Set([...cards.map((c) => c.username), ...profiles.map((p) => p.username)]);

const plan = [];
for (const c of cards) {
  const autoOld = [normalizeSlug(`${c.name ?? ""} ${c.company ?? ""}`), normalizeSlug(c.name ?? "")].filter(Boolean);
  const isAuto = autoOld.some((a) => c.username === a || new RegExp(`^${a}-\\d+$`).test(c.username));
  const target = cardSlug(c.name ?? "", c.company ?? "");
  if (!isAuto) { console.log(`SKIP (custom slug): ${c.username}`); continue; }
  if (!target || target === c.username) { console.log(`SKIP (already/empty): ${c.username}`); continue; }
  let final = target, i = 2;
  while ((taken.has(final) && final !== c.username) || RESERVED.has(final)) final = `${target}-${i++}`;
  taken.add(final);
  plan.push({ ...c, final });
}

console.log(`\n${plan.length} card(s) to rename:`);
for (const p of plan) console.log(`  ${p.username}  →  ${p.final}`);
if (!RUN) { console.log("\nDry run — pass --run to execute."); process.exit(0); }

for (const p of plan) {
  const { data, error: re } = await admin.rpc("rename_card_slug", { p_card_id: p.id, p_user_id: p.user_id, p_new_slug: p.final });
  if (re || !data?.ok) { console.error(`FAILED ${p.username}: ${re?.message || JSON.stringify(data)}`); continue; }
  // copy images to the new slug; KEEP the old files (installed signatures embed them)
  for (const bucket of ["card-shares", "card-signatures"]) {
    const dl = await admin.storage.from(bucket).download(`${p.username}.png`);
    if (!dl.error && dl.data) {
      const up = await admin.storage.from(bucket).upload(`${p.final}.png`, dl.data, { contentType: "image/png", upsert: true });
      if (up.error) console.warn(`  image copy ${bucket} failed: ${up.error.message}`);
    }
  }
  const cust = { ...(p.customization ?? {}) };
  cust._prevSlugs = [...new Set([...(cust._prevSlugs ?? []), p.username])];
  const { error: ce } = await admin.from("cards").update({ customization: cust }).eq("id", p.id);
  if (ce) console.warn(`  _prevSlugs update failed for ${p.final}: ${ce.message}`);
  console.log(`RENAMED ${p.username} → ${p.final}`);
}
console.log("done");
