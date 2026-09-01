import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase-admin";

// Review-queue listing + actions. Item writes also append to
// agent_action_history — the accountability ledger the History view reads.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  try {
    const admin = getAdminSupabase();
    let q = admin.from("agent_queue_items").select("*").order("created_at", { ascending: false }).limit(Math.min(200, Number(p.get("limit") ?? 100)));
    q = q.eq("status", p.get("status") ?? "pending");
    if (p.get("agent")) q = q.eq("agent_id", p.get("agent")!);
    if (p.get("type")) q = q.eq("item_type", p.get("type")!);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ ready: true, items: data });
  } catch {
    return NextResponse.json({ ready: false, items: [] });
  }
}

const ITEM_ACTIONS = new Set(["approved", "rejected", "edited", "contacted", "replied", "converted", "acknowledged", "published", "csv_downloaded", "pending"]);

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.slice(0, 100) : [];
  const action: string = body?.action;
  if (!ids.length || !ITEM_ACTIONS.has(action)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: items } = await admin.from("agent_queue_items").select("*").in("id", ids);
  const now = new Date().toISOString();

  for (const item of items ?? []) {
    let after: string | null = null;
    if (action === "edited" && typeof body.content === "string" && ids.length === 1) {
      after = body.content;
      await admin.from("agent_queue_items").update({ content: after, status: "pending", actioned_at: now }).eq("id", item.id);
    } else if (action === "csv_downloaded") {
      // history-only: downloading the list is worth recording, not a status change
    } else {
      await admin.from("agent_queue_items").update({ status: action, actioned_at: now }).eq("id", item.id);
    }
    await admin.from("agent_action_history").insert({
      item_id: item.id, action, actor_email: user.email,
      edit_before: after ? item.content : null, edit_after: after,
    });
    // Blog publish: flip the post live on /blog from the queued payload.
    if (action === "published" && item.item_type === "blog_post" && item.payload?.slug) {
      const post = item.payload as { slug: string; title: string; description: string; keyword?: string; og_title?: string; content_md: string };
      await admin.from("agent_blog_posts").upsert({
        slug: post.slug, title: post.title, description: post.description,
        keyword: post.keyword ?? null, og_title: post.og_title ?? post.title,
        content_md: post.content_md, status: "published", published_at: now,
      });
      await admin.from("agent_blog_topics").update({ status: "published" }).eq("slug", post.slug);
    }
  }
  return NextResponse.json({ ok: true, count: items?.length ?? 0 });
}
