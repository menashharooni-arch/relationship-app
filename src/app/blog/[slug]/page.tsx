import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/site/SiteNav";
import SiteFooterMini from "@/components/site/SiteFooterMini";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { renderBlogMarkdown } from "@/lib/blog-md";
import { jsonLdScript } from "@/lib/brand";
import HomeHeadingReveal from "@/components/site/HomeHeadingReveal";
import "@/app/home.css";

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
    // bg-cream stays only for the native shell's status-bar canvas rule in
    // globals.css (html.native-app:has(main.bg-cream)); .hp paints the page
    // itself white (owner, 2026-09-17: light pages, no cream).
    <main className="hp sc-canvas-white min-h-screen bg-cream flex flex-col">
      {/* jsonLdScript, not raw stringify: the title/description are LLM-authored — "</script>" inside either must stay inert. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <SiteNav />
      <HomeHeadingReveal />
      <article className="max-w-2xl mx-auto w-full px-5 sm:px-6 pt-28 sm:pt-36 pb-20 flex-1">
        <div data-hp-head>
          <Link href="/blog" className="text-[0.8125rem] font-medium text-slate-500 hover:text-slate-900 transition-colors">← All posts</Link>
          <h1 className="rd-display text-[clamp(2rem,4.4vw,2.9rem)] text-slate-900 mt-4 mb-3 [text-wrap:balance]">{post.title}</h1>
          {post.published_at && <p className="text-slate-500 text-sm mb-8 pb-8 border-b border-slate-200/80">{new Date(post.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>}
        </div>
        <div className="sc-blog-body text-slate-700 text-[1.0125rem] leading-[1.8] [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-9 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 [&_a]:text-brand [&_a]:underline [&_table]:w-full [&_table]:text-sm [&_table]:my-5 [&_th]:text-left [&_th]:font-semibold [&_th]:border-b [&_th]:border-slate-200 [&_th]:py-2 [&_td]:py-2 [&_td]:border-b [&_td]:border-slate-200 [&_blockquote]:border-l-2 [&_blockquote]:border-blue-300 [&_blockquote]:pl-4 [&_blockquote]:text-slate-500"
          dangerouslySetInnerHTML={{ __html: html }} />
        <div className="mt-10 text-center">
          <Link href="/cards/new?src=blog" className="rd-btn rd-btn-primary rd-btn-lg">Create your free card →</Link>
        </div>
      </article>
      <SiteFooterMini extra={[{ label: "Blog", href: "/blog" }]} />
    </main>
  );
}
