import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// TEMPORARY: provision a Pro demo account + two real demo cards used by /preview. Token-guarded.
const TOKEN = "sc-oneoff-9k3d7m2x";

const SALES = {
  username: "demo-sales", label: "Sales Card", name: "Alex Morgan", title: "Account Executive", company: "Northwind SaaS",
  phone: "(415) 555-0142", email: "alex@northwind.io", website: "northwind.io",
  linkedin: "alexmorgan", instagram: "alex.sells", twitter: "", tiktok: "", template: "modern-bold", logo_url: null,
  customization: {
    accentColor: "#2563eb",
    bio: "Helping revenue teams close faster with Northwind. Always happy to talk shop ☕",
    links: [
      { emoji: "📅", label: "Book a 15-min demo", url: "https://cal.com/" },
      { emoji: "📊", label: "See customer case studies", url: "https://northwind.io/customers" },
    ],
  },
};
const REALTY = {
  username: "demo-realty", label: "Real Estate", name: "Alex Morgan", title: "Realtor®", company: "Coastline Realty",
  phone: "(415) 555-0188", email: "alex@coastlinerealty.com", website: "coastlinehomes.com",
  linkedin: "", instagram: "alex.coastalhomes", twitter: "", tiktok: "", template: "local-business", logo_url: null,
  customization: {
    accentColor: "#d97706",
    bio: "Coastal & city homes across the Bay Area. Tap below to browse listings or book a tour 🏡",
    address: { street: "1200 Ocean Ave", unit: "", city: "San Francisco", state: "CA", zip: "94122" },
    facebook: "coastlinerealty",
    links: [
      { emoji: "🏡", label: "Browse active listings", url: "https://coastlinehomes.com/listings" },
      { emoji: "📆", label: "Schedule a private tour", url: "https://cal.com/" },
    ],
  },
};

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) return NextResponse.json({ error: "nope" }, { status: 404 });
  const admin = getAdminSupabase();
  const result: Record<string, unknown> = {};

  // Find or create the demo account.
  const { data: prof } = await admin.from("profiles").select("id").eq("username", "swiftdemo").maybeSingle();
  let userId = prof?.id as string | undefined;
  if (!userId) {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({ email: "demo@swiftcard.me", email_confirm: true });
    result.createUser = { id: created?.user?.id, error: cErr?.message };
    userId = created?.user?.id;
    if (userId) {
      const { error: upErr } = await admin.from("profiles").upsert({ id: userId, username: "swiftdemo", name: "Alex Morgan", plan: "pro" }, { onConflict: "id" });
      result.profileInsert = upErr?.message ?? "ok";
    }
  }
  if (!userId) return NextResponse.json({ error: "no demo user", result });

  const { error: pErr } = await admin.from("profiles").update({ plan: "pro", username: "swiftdemo" }).eq("id", userId);
  result.profileUpdate = pErr?.message ?? "ok";

  for (const c of [SALES, REALTY]) {
    const { error } = await admin.from("cards").upsert({ ...c, user_id: userId }, { onConflict: "username" });
    result[c.username] = error?.message ?? "ok";
  }
  return NextResponse.json({ ok: true, userId, result });
}
