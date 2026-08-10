import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
