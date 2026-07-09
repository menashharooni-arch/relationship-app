import { getAdminSupabase } from "@/lib/supabase-admin";

// All usernames a user owns: their legacy profile username plus every card.
// Used to scope lead access so a user can only touch their own contacts —
// including contacts captured on their additional (non-primary) cards.
export async function getOwnerUsernames(userId: string): Promise<string[]> {
  const admin = getAdminSupabase();
  const [{ data: profile }, { data: cards }] = await Promise.all([
    admin.from("profiles").select("username").eq("id", userId).single(),
    admin.from("cards").select("username").eq("user_id", userId),
  ]);
  const names = [
    profile?.username,
    ...(cards ?? []).map((c: { username: string }) => c.username),
  ].filter(Boolean) as string[];
  // Fallback sentinel so an empty list never matches every row.
  return names.length ? names : ["__none__"];
}
