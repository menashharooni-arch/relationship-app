// Creates the Apple App Review demo account (applereview@swiftcard.me, Pro
// plan) in production Supabase. Idempotent — safe to re-run; bails if the
// account already exists. Prints the generated password ONCE — paste it into
// App Store Connect → App Review Information and store it in a password
// manager; it is not saved anywhere else.
//
// Run from the repo root:  node scripts/create-apple-review-account.js
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

(async () => {
  const email = "applereview@swiftcard.me";
  const password = "SwiftReview!" + crypto.randomBytes(4).toString("hex");

  const { data: existing } = await admin.from("profiles").select("id, plan").eq("email", email).maybeSingle();
  if (existing) {
    console.log("Demo account already exists (id " + existing.id + ", plan " + existing.plan + ").");
    console.log("To reset its password: Supabase Studio → Authentication → Users → applereview@swiftcard.me → Reset password.");
    process.exit(0);
  }

  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) { console.log("Create failed:", error.message); process.exit(1); }
  const id = created.user.id;
  const username = "apple-review-" + id.slice(0, 8);

  // A realistic (fictional) persona so the reviewer sees a genuinely populated
  // product, not a blank demo — this is the strongest answer to the 4.2
  // "just a website" concern. Plan is pro so every feature is visible, and the
  // native build still shows no selling UI anywhere. The card auto-provisions
  // from these fields on first dashboard load (ensureUserCards copies them).
  const { error: pErr } = await admin.from("profiles").insert({
    id,
    username,
    name: "Alex Chen",
    title: "Founder & Principal",
    company: "Northbeam Studio",
    email,
    phone: "(415) 555-0192",
    website: "https://northbeam.example.com",
    linkedin: "alexchen-northbeam",
    instagram: "northbeamstudio",
    twitter: "", tiktok: "",
    template: "classic-pro",
    plan: "pro",
  });
  if (pErr) { console.log("Profile insert failed:", pErr.message); process.exit(1); }

  // Seed a few FICTIONAL captured contacts so Contacts, the pipeline, and the
  // follow-up automations aren't empty for review. Keyed to the profile
  // username, which is how getOwnerUsernames resolves the account's leads.
  const days = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
  const demoLeads = [
    { name: "Jordan Rivera", phone: "(415) 555-0148", email: "jordan.rivera@example.com", company: "Rivera Design Co.", location: "Austin, TX", where_met: "Austin Founders Mixer", notes: "Sample contact — delete anytime. Interested in a Q3 rebrand, comparing vendors. Prefers email, weekday mornings.", message: "Great meeting you — would love to see some recent work!", status: "new_contact", source: "qr_code", tags: ["demo", "unread"], created_at: days(2) },
    { name: "Priya Nair", phone: "(628) 555-0113", email: "priya.nair@example.com", company: "Lumen Health", location: "San Francisco, CA", where_met: "SaaS Connect 2026", notes: "Sample contact. Wants a follow-up deck next week; budget approved.", message: "Thanks for the chat about onboarding flows!", status: "touch", source: "nfc_card", tags: ["demo"], created_at: days(6) },
    { name: "Marcus Webb", phone: "(917) 555-0176", email: "marcus.webb@example.com", company: "Webb & Co.", location: "New York, NY", where_met: "Referral", notes: "Sample contact. Kickoff scheduled — staying in touch.", message: "Looking forward to working together.", status: "touch", source: "direct_link", tags: ["demo"], created_at: days(12) },
  ];
  const { error: lErr } = await admin.from("leads").insert(demoLeads.map((l) => ({ ...l, card_owner: username })));
  if (lErr) console.log("Note: demo leads not seeded (" + lErr.message + ") — account still works.");

  // Seed some fictional card views across the last few weeks + a couple traffic
  // sources so the analytics dashboard shows real numbers, not zeros.
  const sources = ["qr_code", "direct_link", "nfc_card", "share"];
  const views = [];
  for (let i = 0; i < 24; i++) {
    views.push({
      username,
      viewed_at: days(Math.floor(Math.random() * 28)),
      visitor_id: "demo-visitor-" + (i % 9),
      source: sources[i % sources.length],
      location: ["Austin, TX", "San Francisco, CA", "New York, NY", "Chicago, IL"][i % 4],
    });
  }
  const { error: vErr } = await admin.from("card_views").insert(views);
  if (vErr) console.log("Note: demo views not seeded (" + vErr.message + ") — account still works.");

  console.log("✅ Demo account created (persona: Alex Chen, Northbeam Studio)");
  console.log("   email:    " + email);
  console.log("   password: " + password);
  console.log("   seeded:   " + demoLeads.length + " demo contacts + " + views.length + " card views");
  console.log("   (the card auto-provisions from the profile on first dashboard load)");
})();
