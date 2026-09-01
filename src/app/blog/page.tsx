import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import { getAdminSupabase } from "@/lib/supabase-admin";

// ── The SwiftCard blog ───────────────────────────────────────────────────────
// Posts are written by the Blog Writer agent, reviewed in the Agent Flow tab,
// and published from there into agent_blog_posts. This page reads ONLY
// status='published' rows via the server admin client — there is no user
// write path to this table (RLS on, no policies).
export const revalidate = 300;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export const metadata: Metadata = {
  title: "Blog | SwiftCard",
  description: "Guides and honest comparisons on digital business cards, lead capture, follow-up, and networking that actually converts.",
  alternates: { canonical: `${APP_URL}/blog` },
};

export default async function BlogIndexPage() {
  let posts: { slug: string; title: string; description: string; published_at: string | null }[] = [];
  try {
    const { data } = await getAdminSupabase()
      .from("agent_blog_posts")
      .select("slug, title, description, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(100);
    posts = data ?? [];
  } catch { /* table not created yet — render the empty state */ }

  return (
    <main className="min-h-screen bg-cream flex flex-col">
      <SiteNav />
      <section className="text-center px-6 pt-28 pb-10">
        <p className="text-[11px] font-bold tracking-[0.25em] text-brand uppercase mb-4">Blog</p>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">The SwiftCard blog</h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">Digital business cards, lead capture, and following up — written plainly, compared honestly.</p>
      </section>
      <section className="max-w-2xl mx-auto w-full px-6 pb-16 flex-1">
        {posts.length === 0 && <p className="text-slate-500 text-center">First posts are on the way.</p>}
        <div className="flex flex-col gap-3">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="rounded-2xl border border-warm-border bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-slate-900 font-semibold text-[17px]">{p.title}</p>
              <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">{p.description}</p>
              {p.published_at && <p className="text-slate-400 text-xs mt-2">{new Date(p.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>}
            </Link>
          ))}
        </div>
      </section>
      <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <SwiftCardLogo size={24} />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact Us</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms</Link>
          </div>
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} SwiftCard · New York, NY</p>
        </div>
      </footer>
    </main>
  );
}
