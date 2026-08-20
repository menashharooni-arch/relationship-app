// Verify both App Review demo accounts can sign in (run before resubmission).
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const [email, password] of [
  ["applereview-free@swiftcard.me", process.env.FREE_PW],
  ["applereview@swiftcard.me", process.env.PRO_PW],
]) {
  if (!password) { console.log(email, "— no pw provided, skipped"); continue; }
  const { data, error } = await anon().auth.signInWithPassword({ email, password });
  console.log(email, error ? `FAILED: ${error.message}` : `OK (user ${data.user.id.slice(0, 8)})`);
}
