// Creates the Apple App Review demo accounts in production Supabase.
//
//   node scripts/create-apple-review-account.js          # both
//   node scripts/create-apple-review-account.js free     # just the Free one
//   node scripts/create-apple-review-account.js pro      # just the Pro one
//
// TWO accounts, on purpose. The 1.0.0 (3) rejection under Guideline 3.1.1 was
// partly self-inflicted: we handed App Review a Pro account and a test script
// that walked them through Pro-only features, while the notes claimed "nothing
// is unlocked in-app". The reviewer saw paid content and no way to buy it.
//
// So the reviewer now gets both:
//   • Free — the app in its DEFAULT state. Plan gates are visible, each with
//     the "Subscribe on swiftcard.me" button that opens the default browser
//     (the US-storefront external purchase link permitted by 3.1.1(a)).
//   • Pro  — every feature exercisable, so nothing looks hidden or broken.
//
// Idempotent — safe to re-run; skips any account that already exists. Prints
// each generated password ONCE; paste them into App Store Connect → App Review
// Information and store them in a password manager. They are saved nowhere else.
/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) {
  console.log("Missing env — need NEXT_PUBLIC_SUPABASE_URL and the service-role key in .env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// Two distinct fictional personas so the reviewer can tell the accounts apart
// at a glance, and neither looks like a stripped copy of the other.
const ACCOUNTS = {
  pro: {
    email: "applereview@swiftcard.me",
    plan: "pro",
    profile: {
      name: "Alex Chen",
      title: "Founder & Principal",
      company: "Northbeam Studio",
      phone: "(415) 555-0192",
      website: "https://northbeam.example.com",
      linkedin: "alexchen-northbeam",
      instagram: "northbeamstudio",
      template: "classic-pro",
    },
  },
  free: {
    email: "applereview-free@swiftcard.me",
    plan: "free",
    profile: {
      name: "Sam Okafor",
      title: "Real Estate Agent",
      company: "Harbor & Oak Realty",
      phone: "(415) 555-0137",
      website: "https://harborandoak.example.com",
      linkedin: "samokafor",
      instagram: "harborandoak",
      template: "local-business",
    },
  },
};

const days = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

// Free caps new contacts per month, so the Free account is seeded with fewer —
// a Free demo showing an impossible number of contacts would itself look wrong.
function leadsFor(plan, username) {
  const all = [
    { name: "Jordan Rivera", phone: "(415) 555-0148", email: "jordan.rivera@example.com", company: "Rivera Design Co.", location: "Austin, TX", where_met: "Austin Founders Mixer", notes: "Sample contact — delete anytime. Interested in a Q3 rebrand, comparing vendors. Prefers email, weekday mornings.", message: "Great meeting you — would love to see some recent work!", status: "new_contact", source: "qr_code", tags: ["demo", "unread"], created_at: days(2) },
    { name: "Priya Nair", phone: "(628) 555-0113", email: "priya.nair@example.com", company: "Lumen Health", location: "San Francisco, CA", where_met: "SaaS Connect 2026", notes: "Sample contact. Wants a follow-up deck next week; budget approved.", message: "Thanks for the chat about onboarding flows!", status: "touch", source: "nfc_card", tags: ["demo"], created_at: days(6) },
    { name: "Marcus Webb", phone: "(917) 555-0176", email: "marcus.webb@example.com", company: "Webb & Co.", location: "New York, NY", where_met: "Referral", notes: "Sample contact. Kickoff scheduled — staying in touch.", message: "Looking forward to working together.", status: "touch", source: "direct_link", tags: ["demo"], created_at: days(12) },
  ];
  return (plan === "free" ? all.slice(0, 2) : all).map((l) => ({ ...l, card_owner: username }));
}

function viewsFor(username) {
  const sources = ["qr_code", "direct_link", "nfc_card", "share"];
  const views = [];
  const VISITORS = 9;
  for (let i = 0; i < 24; i++) {
    // (username, visitor_id, day) is UNIQUE — uq_card_views_username_visitor_day.
    // Random days collide within 24 draws over 28 often enough to be effectively
    // guaranteed, and since this is one batch insert a single collision rejects
    // ALL 24 rows — leaving the reviewer an analytics dashboard of zeros, which
    // is the opposite of the point. Derive the day from the index so every pair
    // is unique by construction; spans ~26 days with a few repeat visitors.
    const visitor = i % VISITORS;
    const repeat = Math.floor(i / VISITORS);
    views.push({
      username,
      viewed_at: days(visitor * 3 + repeat),
      visitor_id: "demo-visitor-" + visitor,
      source: sources[i % sources.length],
      location: ["Austin, TX", "San Francisco, CA", "New York, NY", "Chicago, IL"][i % 4],
    });
  }
  return views;
}

async function ensure(tier) {
  const spec = ACCOUNTS[tier];
  const { email, plan } = spec;

  const { data: existing } = await admin.from("profiles").select("id, plan").eq("email", email).maybeSingle();
  if (existing) {
    console.log(`• ${tier.toUpperCase()} account already exists (id ${existing.id}, plan ${existing.plan}) — ${email}`);
    console.log(`  Reset its password in Supabase Studio → Authentication → Users → ${email}.`);
    return;
  }

  const password = "SwiftReview!" + crypto.randomBytes(4).toString("hex");
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) { console.log(`✗ ${tier}: create failed — ${error.message}`); return; }

  const id = created.user.id;
  const username = "apple-review-" + id.slice(0, 8);

  // The card auto-provisions from these fields on first dashboard load
  // (ensureUserCards copies them), so the reviewer lands on a populated app
  // rather than an empty state — which is also the strongest answer to any 4.2
  // "it's just a website" concern.
  const { error: pErr } = await admin.from("profiles").insert({
    id, username, email, plan,
    twitter: "", tiktok: "",
    ...spec.profile,
  });
  if (pErr) { console.log(`✗ ${tier}: profile insert failed — ${pErr.message}`); return; }

  const leads = leadsFor(plan, username);
  const { error: lErr } = await admin.from("leads").insert(leads);
  if (lErr) console.log(`  note: ${tier} leads not seeded (${lErr.message}) — account still works.`);

  const views = viewsFor(username);
  const { error: vErr } = await admin.from("card_views").insert(views);
  if (vErr) console.log(`  note: ${tier} views not seeded (${vErr.message}) — account still works.`);

  console.log(`✅ ${tier.toUpperCase()} demo account created — ${spec.profile.name}, ${spec.profile.company}`);
  console.log(`   email:    ${email}`);
  console.log(`   password: ${password}`);
  console.log(`   seeded:   ${leads.length} contacts + ${views.length} card views`);
}

(async () => {
  const which = process.argv[2];
  const tiers = which === "free" || which === "pro" ? [which] : ["pro", "free"];
  for (const t of tiers) await ensure(t);
  console.log("\nPaste both into App Store Connect → App Review Information.");
  console.log("The Free one matters: it shows the app in its default state, with the");
  console.log("plan gates and the 'Subscribe on swiftcard.me' link the reviewer asked for.");
})();
