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

  // A PLAIN FORM POST is a first-class caller, not an error path. The chip is a
  // real <form method="post">, so a tap that lands before React hydrates
  // submits the browser's own way — and this route answering it with a JSON
  // error page left that person staring at `{"error":…}` with their dashboard
  // gone. Form posts save and come straight back to the dashboard; JSON
  // callers (the hydrated chip) get JSON, exactly as before.
  const form = !req.headers.get("content-type")?.includes("application/json");
  const body = form
    ? await req.formData().then((f) => ({ label: f.get("label") }), () => ({ label: null }))
    : await req.json().catch(() => ({}));
  const backToDashboard = () => NextResponse.redirect(new URL("/dashboard", req.url), 303);
  const label = body?.label === null ? null : cleanEventLabel(body?.label);
  // An empty name from a form is "never mind", not an error worth a page of
  // its own: nothing is saved and they are back where they were.
  if (body?.label !== null && !label) {
    return form ? backToDashboard() : NextResponse.json({ error: "Give the event a name" }, { status: 400 });
  }

  // No `until` on a form post (the local midnight is the hydrated chip's to
  // send) — eventUntil falls back to 12 hours, and never past a day either way.
  const next = label ? { label, until: eventUntil((body as { until?: unknown })?.until) } : null;
  const result = await mutateCustomization<unknown>(user.id, EVENT_KEY, () => next);
  if (!result.ok) {
    return form ? backToDashboard() : NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
  return form ? backToDashboard() : NextResponse.json({ event: next });
}
