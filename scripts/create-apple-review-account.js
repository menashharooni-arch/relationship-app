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

  // Mirrors /onboarding's provisioning insert, with plan already set to pro so
  // the reviewer sees the full product (locked features show content, and the
  // native build shows no selling UI anywhere).
  const { error: pErr } = await admin.from("profiles").insert({
    id,
    username: "apple-review-" + id.slice(0, 8),
    name: "Apple Reviewer",
    title: "App Review",
    company: "SwiftCard Demo",
    email,
    phone: "", website: "", linkedin: "", instagram: "", twitter: "", tiktok: "",
    template: "classic-pro",
    plan: "pro",
  });
  if (pErr) { console.log("Profile insert failed:", pErr.message); process.exit(1); }

  console.log("✅ Demo account created");
  console.log("   email:    " + email);
  console.log("   password: " + password);
  console.log("   (cards auto-provision on first dashboard load)");
})();
