import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/site/SiteNav";
import SwiftCardLogo from "@/components/SwiftCardLogo";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { renderBlogMarkdown } from "@/lib/blog-md";
import { jsonLdScript } from "@/lib/brand";

export const revalidate = 300;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

async function getPost(slug: string) {
  try {
    const { data } = await getAdminSupabase()
      .from("agent_blog_posts")
      .select("slug, title, description, keyword, og_title, content_md, published_at")
      .eq("slug", slug.toLowerCase())
      .eq("status", "published")
      .maybeSingle();
    return data ?? null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Blog | SwiftCard" };
  return {
    title: `${post.title} | SwiftCard`,
    description: post.description,
    alternates: { canonical: `${APP_URL}/blog/${post.slug}` },
    openGraph: { title: post.og_title ?? post.title, description: post.description, url: `${APP_URL}/blog/${post.slug}`, siteName: "SwiftCard", type: "article" },
    twitter: { card: "summary_large_image", title: post.og_title ?? post.title, description: post.description },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const html = renderBlogMarkdown(post.content_md);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Article",
    headline: post.title, description: post.description,
    datePublished: post.published_at, url: `${APP_URL}/blog/${post.slug}`,
    publisher: { "@id": `${APP_URL}/#organization` },
  };
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      {/* jsonLdScript, not raw stringify: the title/description are LLM-authored — "</script>" inside either must stay inert. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <SiteNav />
      <article className="max-w-2xl mx-auto w-full px-6 pt-28 pb-16 flex-1">
        <Link href="/blog" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">← All posts</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-3 mb-2 [text-wrap:balance]">{post.title}</h1>
        {post.published_at && <p className="text-slate-400 text-sm mb-8">{new Date(post.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>}
        <div className="sc-blog-body text-slate-700 text-[15.5px] leading-relaxed [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-9 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 [&_a]:text-brand [&_a]:underline [&_table]:w-full [&_table]:text-sm [&_table]:my-5 [&_th]:text-left [&_th]:font-semibold [&_th]:border-b [&_th]:border-warm-border [&_th]:py-2 [&_td]:py-2 [&_td]:border-b [&_td]:border-warm-border [&_blockquote]:border-l-2 [&_blockquote]:border-warm-border [&_blockquote]:pl-4 [&_blockquote]:text-slate-500"
          dangerouslySetInnerHTML={{ __html: html }} />
        <div className="mt-10 text-center">
          <Link href="/cards/new?src=blog" className="btn-cta bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-colors inline-block">Create your free card →</Link>
        </div>
      </article>
      <footer className="border-t border-warm-border py-10 px-6 bg-cream mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <SwiftCardLogo size={24} />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-slate-900 transition-colors">Blog</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms</Link>
          </div>
          <p className="text-slate-400 text-xs">© {new Date().getFullYear()} SwiftCard · New York, NY</p>
        </div>
      </footer>
    </main>
  );
}
