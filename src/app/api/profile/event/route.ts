import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { mutateCustomization } from "@/lib/profile-customization";
import { cleanEventLabel, EVENT_KEY, eventUntil } from "@/lib/event-tag";

// Set or clear the owner's "At an event?" tag (lib/event-tag.ts). Written
// through mutateCustomization, the verified read-back every writer of the
// shared customization column must use.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const label = body?.label === null ? null : cleanEventLabel(body?.label);
  if (body?.label !== null && !label) return NextResponse.json({ error: "Give the event a name" }, { status: 400 });

  const next = label ? { label, until: eventUntil(body?.until) } : null;
  const result = await mutateCustomization<unknown>(user.id, EVENT_KEY, () => next);
  if (!result.ok) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  return NextResponse.json({ event: next });
}
