import { getAdminSupabase } from "@/lib/supabase-admin";
import { isAdminEmail } from "@/lib/admin";
import { isTestMailbox } from "@/lib/test-mailbox";
import type { EventName } from "@/lib/events";

// A funnel event recorded by the SERVER, at the moment the thing actually
// happened — for steps a browser can't be trusted to report (the click that
// navigates away, three different screens that all "pick a plan").
//
// Same table and the same "is this our own traffic?" labelling as the browser
// sink (/api/events): not production, an admin or demo account, or a QA
// throwaway mailbox. Never throws — analytics must never fail the request.
export async function recordServerEvent(
  name: EventName,
  props: Record<string, string | number>,
  opts: { path: string; email: string | null | undefined },
): Promise<void> {
  try {
    const email = (opts.email ?? "").toLowerCase();
    const isInternal =
      process.env.VERCEL_ENV !== "production" ||
      isAdminEmail(email) ||
      email === "demo@swiftcard.me" ||
      isTestMailbox(email);
    await getAdminSupabase().from("product_events").insert({ name, props, path: opts.path, is_internal: isInternal });
  } catch {
    /* best-effort */
  }
}
