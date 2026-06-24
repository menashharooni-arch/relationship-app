import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

function isValidTime(t: string) {
  return /^\d{2}:\d{2}$/.test(t);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const key of ["day1", "day15", "day30"] as const) {
    const day = body[key] as { enabled?: unknown; time?: unknown } | undefined;
    if (typeof day?.enabled !== "boolean" || !isValidTime((day?.time as string) ?? "")) {
      return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ flow_settings: body })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("flow_settings")
    .eq("id", user.id)
    .single();

  const defaults = {
    day1:  { enabled: true, time: "13:00" },
    day15: { enabled: true, time: "13:00" },
    day30: { enabled: true, time: "13:00" },
    presets: {
      "1": { name: "Warm Touch", days: [1, 7] },
      "2": { name: "Standard", days: [1, 15, 30] },
      "3": { name: "Long-term", days: [7, 30, 60] },
    },
  };

  return NextResponse.json({ ...defaults, ...(profile?.flow_settings as object ?? {}) });
}
