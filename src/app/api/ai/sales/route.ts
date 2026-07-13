import { aiComplete, hasAiProvider } from "@/lib/ai";
import { isRateLimited } from "@/lib/rate-limit";
import { PLAN_LIMITS, PLAN_PRICES, TRIAL_DAYS } from "@/lib/plan";
import { NextRequest, NextResponse } from "next/server";

// Public (unauthenticated) sales assistant for the marketing site. Answers
// "what is SwiftCard / what does it cost / how does it work" for visitors and
// points them to sign-up. Mirrors /api/ai/help's design: instant knowledge-base
// answers first, provider-flexible LLM fallback second, helpful static fallback
// last. Because it's public it is IP rate-limited and size-capped.
//
// COMPLIANCE: prices and limits are imported from lib/plan (the single source
// of truth) so the bot can never quote a stale number, and the prompt forbids
// invented statistics, reviews, or discounts (FTC deceptive-practices risk).

const PRO_MO = (PLAN_PRICES.PRO_MONTHLY_CENTS / 100).toFixed(2);
const PRO_YR = (PLAN_PRICES.PRO_ANNUAL_CENTS / 100).toFixed(2);
const OFFICE_MO = (PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS / 100).toFixed(2);
const OFFICE_YR = (PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS / 100).toFixed(2);

const PRICING_FACTS = `PRICING (USD, the only prices that exist — never invent discounts or other numbers):
- Free: $0 — 1 card, ${PLAN_LIMITS.FREE_LEADS_PER_MONTH} new leads/month, ${PLAN_LIMITS.FREE_SCANS_PER_MONTH} AI card scans/month, ${PLAN_LIMITS.FREE_AI_DRAFTS_PER_MONTH} AI drafts/month, all templates, ${PLAN_LIMITS.FREE_MAX_LINKS} Swift Links button, view analytics, a "Powered by SwiftCard" badge on the card.
- Pro: $${PRO_MO}/month, or $${PRO_YR}/year (~10% off). Unlimited cards, leads, scans and drafts; custom card designer; automated email + text follow-up sequences; premium Swift Links; full analytics; CSV export; integrations (Zapier, Google Contacts, HubSpot); no SwiftCard branding.
- Office (teams): $${OFFICE_MO}/month per seat, or $${OFFICE_YR}/year per seat — everything in Pro for each seat, minimum ${PLAN_LIMITS.OFFICE_MIN_SEATS} seats, with an admin who manages the team's cards and brand.
- Every new signup gets a ${TRIAL_DAYS}-day free trial of full Pro — no credit card needed to start. Cancel anytime; payments are handled by Stripe.`;

const SYSTEM_PROMPT = `You are the friendly sales assistant on the SwiftCard marketing site (swiftcard.me). Visitors are NOT logged in. Your job: answer questions about what SwiftCard is, what it costs, and how it works — accurately and concisely — and invite them to try it free at /cards/new (no account needed to start building).

WHAT SWIFTCARD IS
- A digital business card. You build a card once; share it by link, QR code, Apple Wallet pass, or NFC. The other person needs NO app — the card opens in their browser and saves to their contacts in one tap.
- Every card also gets a Swift Links page (link-in-bio with photo, bio, socials, and custom buttons — great for Instagram/TikTok bios).
- When someone shares their info through your card, they land in your contacts with automatic follow-up (email and, on Pro, texts) so leads never go cold.
- Analytics show views, sources, and locations. An email-signature generator puts your live card in every email.

${PRICING_FACTS}

STRICT RULES
- Only discuss SwiftCard. For anything else, politely decline and steer back.
- NEVER invent statistics, customer counts, reviews, testimonials, ratings, discounts, or features. If you don't know, say so and point to the contact page (/contact).
- You cannot access accounts or take actions. For support questions from existing customers, suggest logging in and using the in-app assistant, or /contact.
- Keep answers short (2-5 sentences), plain language, no pressure. End with a light pointer to /cards/new or /pricing when it fits naturally.`;

const FALLBACK =
  "I can help with questions about SwiftCard — what it is, pricing, and how it works. For anything else, reach the team at swiftcard.me/contact. Want to see it in action? You can build a free card in about 60 seconds at swiftcard.me/cards/new.";

// ── Instant answers (free, work with no AI provider) ────────────────────────
type KbEntry = { triggers: string[]; answer: string };

const KB: KbEntry[] = [
  {
    triggers: ["hello", "hi", "hey", "what can you do"],
    answer:
      "Hi! I can answer anything about SwiftCard — what it is, what it costs, and how it works. Try \"What is SwiftCard?\", \"How much does it cost?\", or \"Do people need an app to get my card?\"",
  },
  {
    triggers: ["what is swiftcard", "what is this", "what does swiftcard do", "how does it work", "what do you sell"],
    answer:
      "SwiftCard is a digital business card. Build your card once, then share it by link, QR code, Apple Wallet, or NFC — the other person needs no app; it opens in their browser and saves to their phone in one tap. Everyone who shares their info back lands in your contacts with automatic follow-up. You can build one free in about 60 seconds at swiftcard.me/cards/new.",
  },
  {
    triggers: ["price", "pricing", "cost", "how much", "expensive", "plans", "subscription"],
    answer:
      `Three plans: Free ($0 — 1 card, ${PLAN_LIMITS.FREE_LEADS_PER_MONTH} new leads/month, all templates), Pro ($${PRO_MO}/month or $${PRO_YR}/year — unlimited everything, custom designer, automated email + text follow-ups, integrations, no branding), and Office for teams ($${OFFICE_MO}/month per seat, min ${PLAN_LIMITS.OFFICE_MIN_SEATS} seats). Every new signup starts with a ${TRIAL_DAYS}-day free Pro trial — no credit card needed. Full details at swiftcard.me/pricing.`,
  },
  {
    triggers: ["free plan", "free tier", "is it free", "free trial", "trial"],
    answer:
      `Yes — Free gets you a full card with every template, a Swift Links page, analytics, and ${PLAN_LIMITS.FREE_LEADS_PER_MONTH} new leads a month. New signups also get ${TRIAL_DAYS} days of full Pro free, no credit card required. Start at swiftcard.me/cards/new.`,
  },
  {
    triggers: ["need an app", "download", "do they need", "receive my card", "no app", "without an app", "app required"],
    answer:
      "No app needed on either side. Your card is a link — share it by QR, text, Apple Wallet, or NFC, and it opens in the other person's browser. They can save your contact to their phone in one tap.",
  },
  {
    triggers: ["apple wallet", "wallet", "apple watch", "watch", "nfc"],
    answer:
      "Your SwiftCard lives in Apple Wallet (and shows on Apple Watch), so your QR is always two taps away. You can also write your card link to any NFC tag for tap-to-share.",
  },
  {
    triggers: ["team", "teams", "office", "company", "employees", "org", "business account"],
    answer:
      `The Office plan puts your whole team on matching, brand-synced cards — an admin manages everyone's cards, and updating the brand once updates every card. $${OFFICE_MO}/month per seat (minimum ${PLAN_LIMITS.OFFICE_MIN_SEATS} seats), each seat with full Pro features. See swiftcard.me/pricing.`,
  },
  {
    triggers: ["follow up", "follow-up", "automation", "sequences", "crm", "leads", "lead capture"],
    answer:
      "When someone shares their info through your card, they land in your contacts automatically. Set a follow-up cadence once and SwiftCard sends the emails (and texts, on Pro) for you — each signed with your live card. Pro also syncs new leads to Zapier, Google Contacts, or HubSpot.",
  },
  {
    triggers: ["swift links", "link in bio", "linktree", "bio link", "instagram bio"],
    answer:
      "Every card includes a Swift Links page — your photo, bio, socials, and a custom button on one link. Drop it in your Instagram or TikTok bio; Free includes 1 Swift Links button, and Pro unlocks unlimited buttons plus premium tiles.",
  },
  {
    triggers: ["cancel", "refund", "lock in", "lock-in", "commitment", "contract"],
    answer:
      "No contracts — cancel anytime from billing settings and you keep access through the end of the billing period. Payments are handled securely by Stripe. Details: swiftcard.me/terms.",
  },
  {
    triggers: ["review", "reviews", "testimonial", "rating", "legit", "trust", "scam", "who uses"],
    answer:
      "Honest answer: SwiftCard is new, and we don't publish reviews we don't have — no invented ratings here. The best way to judge it is to try it: the free plan takes about 60 seconds to set up at swiftcard.me/cards/new. You can also see what it does for different professions at swiftcard.me/testimonials.",
  },
  {
    triggers: ["privacy", "data", "secure", "security", "gdpr", "sell my data"],
    answer:
      "Your card only shows what you choose to make public, data is encrypted in transit and at rest, and SwiftCard never sells your data or your contacts' data. Full policy: swiftcard.me/privacy.",
  },
  {
    triggers: ["support", "contact", "human", "talk to someone", "email you"],
    answer: "You can reach the team at swiftcard.me/contact — they read everything.",
  },
  {
    triggers: ["get started", "sign up", "signup", "create a card", "start"],
    answer:
      "Head to swiftcard.me/cards/new — you can build your card before creating an account, and the free plan (plus a 14-day Pro trial) means there's nothing to pay to start.",
  },
];

function normalize(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

function localAnswer(question: string): string | null {
  const q = normalize(question);
  let best = { score: 0, answer: "" };
  for (const entry of KB) {
    let score = 0;
    for (const t of entry.triggers) {
      const words = t.split(" ").length;
      if (q.includes(` ${t} `) || (words > 1 && q.includes(t))) score += words;
    }
    if (score > best.score) best = { score, answer: entry.answer };
  }
  return best.score >= 1 ? best.answer : null;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  // Public endpoint → strict per-IP limit (20 messages / 10 minutes).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (await isRateLimited(`sales-chat:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json(
      { reply: "You've sent quite a few messages — give it a few minutes and try again, or reach the team at swiftcard.me/contact." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMessage[] = raw
    .filter((m: unknown): m is ChatMessage =>
      !!m && typeof m === "object" &&
      ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
      typeof (m as ChatMessage).content === "string")
    .slice(-10)
    .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, 1000) }));

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return NextResponse.json({ error: "No question provided." }, { status: 400 });

  // 1) Knowledge base — instant and free.
  const local = localAnswer(lastUser.content);
  if (local) return NextResponse.json({ reply: local });

  // 2) LLM fallback when a provider is configured.
  if (hasAiProvider()) {
    const convo = messages.map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`).join("\n");
    const prompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${convo}\n\nReply as the assistant to the visitor's last message.`;
    const reply = await aiComplete(prompt, { maxTokens: 500 });
    if (reply) return NextResponse.json({ reply });
  }

  return NextResponse.json({ reply: FALLBACK });
}
