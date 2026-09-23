import type { getAdminSupabase } from "@/lib/supabase-admin";

type Admin = ReturnType<typeof getAdminSupabase>;

// Everyone whose plan is SOMEONE ELSE's Office seat: an active member of an
// office they don't own. Their plan is paid by their company, so an offer for
// a plan ("N days of SwiftCard Pro, free", a discount code) is one they can't
// use and shouldn't be sold — the same rule the app itself follows (a team
// member is never asked to choose a plan or pay). Office OWNERS are customers
// in their own right and are not in this set.
//
// Paged: PostgREST caps a plain select at 1,000 rows, and a list that silently
// stops at the thousandth member would mail the rest.
export async function officeTeamMemberIds(admin: Admin): Promise<Set<string>> {
  const PAGE = 1000;
  const owners = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from("offices").select("owner_id").range(from, from + PAGE - 1);
    if (error) throw new Error(`offices: ${error.message}`);
    for (const o of data ?? []) if (o.owner_id) owners.add(o.owner_id as string);
    if (!data || data.length < PAGE) break;
  }
  const members = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("office_members")
      .select("user_id")
      .eq("status", "active")
      .not("user_id", "is", null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`office_members: ${error.message}`);
    for (const m of data ?? []) {
      const id = m.user_id as string | null;
      if (id && !owners.has(id)) members.add(id);
    }
    if (!data || data.length < PAGE) break;
  }
  return members;
}
