import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Hard 10s cap on every call this client makes. During the 2026-08-27
      // Supabase auth brownout, pages awaiting getUser()/queries held their
      // streams open indefinitely — the app showed skeletons (or black in the
      // shell) forever. With the cap they throw instead, and the app-level
      // error boundary shows its "Something went wrong / Try again" screen.
      // 10s is ~20× the normal round-trip, so healthy traffic never hits it.
      global: {
        fetch: (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(url, { ...init, signal: AbortSignal.timeout(10000) }),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In a Server Component cookies can't be written — src/proxy.ts
          // refreshes the session there. (Next 16 renamed the `middleware`
          // file convention to `proxy`; a middleware.ts here would never run.)
          // Swallow so getUser() never throws on public pages (e.g. /card,
          // /links) for logged-in visitors.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* called from a Server Component — safe to ignore */
          }
        },
      },
    }
  );
}
