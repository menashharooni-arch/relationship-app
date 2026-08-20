// Set a fresh password on the PRO review demo account (applereview@swiftcard.me)
// and print it once — for the App Review notes before a resubmission.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { config } from "dotenv";
config({ path: ".env.local" });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "applereview@swiftcard.me";
const { data: profile, error: pErr } = await admin.from("profiles").select("id").eq("email", EMAIL).single();
if (pErr || !profile) { console.log("profile not found:", pErr?.message); process.exit(1); }

const password = `SwiftReview!${crypto.randomBytes(4).toString("hex")}`;
const { error } = await admin.auth.admin.updateUserById(profile.id, { password });
if (error) { console.log("update failed:", error.message); process.exit(1); }
console.log(`${EMAIL} password set: ${password}`);
