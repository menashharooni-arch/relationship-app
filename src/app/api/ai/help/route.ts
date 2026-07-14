import { aiComplete, hasAiProvider } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const SYSTEM_PROMPT = `You are the in-app help assistant for SwiftCard (swiftcard.me), a digital business card app. You help logged-in users find features and how to do things. Be friendly, concise, and practical with step-by-step directions ("Go to … → click …"). If unsure or it's outside SwiftCard, say so and suggest the Contact page — never invent features.

IMPORTANT: You can ONLY give directions and answer questions. You cannot make any changes, perform actions, edit cards, change settings, send anything, or access or modify the user's account or data. Never claim to have done something for the user. If they ask you to do something, explain the steps so they can do it themselves.

WHAT SWIFTCARD IS
- A digital business card. One account can hold multiple cards. Each card has a card page (swiftcard.me/card/<url>) and a Swift Links page (swiftcard.me/links/<url>) — a link-in-bio with photo, bio, social icons, video previews, and custom buttons.
- Free (monthly meters that reset on the 1st): 1 card, 5 new leads/month, 3 AI drafts/month, 3 card scans/month, all templates, 1 Swift Links button, basic analytics (views & best day), a Day-1 follow-up email, and a "Powered by SwiftCard" badge. Over the 5-lead cap, extra leads are still captured but locked until upgrade. Pro: unlimited leads/drafts/scans, unlimited cards, custom card designer, automated email + text follow-up sequences (Light/Medium/Aggressive), premium Swift Links (video previews, featured tiles, themes), full who/when/where analytics, CSV export, integrations (Zapier, Google, HubSpot), no SwiftCard branding. Office = everything in Pro for each seat, $1/user cheaper, min 2 seats, with an admin who makes cards for the team.

KEY PLACES
- Dashboard: pick a card, see analytics (Card/Link views toggle), and the bottom section (Notifications default / List / Pipeline). "Your Card" panel has Share + "Other ways to share" (link + QR).
- Create a card: dashboard "+ Add card" → 3 steps (details + address → Swift Links bio/socials/links → logo, headshot, design).
- Edit a card: My Cards → Edit, or Settings → Your cards → Edit. Tabs: Card info, Design (templates + Pro custom designer).
- Contacts: everyone who saved your card or messaged you; read/unread, conversation, notes, status, AI follow-up, SMS, export.
- Settings: Your cards, Need help, Integrations, General (email/cards), Billing (change plan, cancel, keep subscription, seats, payment method), Account → Danger Zone (delete + 1-month reopen).

Keep answers short. Use plain language.`;

// ── Built-in knowledge base (works with no API / no credits) ────────────────
type KbEntry = { triggers: string[]; answer: string };

const KB: KbEntry[] = [
  {
    triggers: ["hello", "hi", "hey", "what can you do", "what can you help", "help me"],
    answer:
      "Hi! I can help you find features and learn how to do things in SwiftCard. Try asking things like \"How do I create a card?\", \"How do I share my card?\", \"Where are my contacts?\", or \"How do I upgrade to Pro?\"",
  },
  {
    triggers: ["create a card", "make a card", "new card", "add card", "add a card", "create my card", "get started", "first card", "set up a card"],
    answer:
      "From your dashboard, click \"+ Add card\" (or the big \"Create your card\" button if you don't have one yet). It's a quick 3-step wizard: 1) your details + address, 2) Swift Links bio, social links & extra buttons, 3) upload your logo/headshot and choose a design.",
  },
  {
    triggers: ["edit a card", "edit card", "edit my card", "update my card", "change my info", "change my name", "change my phone", "change my email", "change my number"],
    answer:
      "Open the card from your dashboard (My Cards → Edit) or go to Settings → Your cards → Edit. The editor has two tabs: \"Card info\" (name, contact details, bio, socials, logo, headshot, address) and \"Design\".",
  },
  {
    triggers: ["design", "template", "change design", "change template", "change my design", "theme", "fonts", "colors", "custom design", "customize my card", "card look"],
    answer:
      "Edit your card and open the \"Design\" tab to pick a template. Pro users also get \"Custom design\" — a drag-and-drop designer where you place your logo, headshot, text and choose fonts, text color, and background.",
  },
  {
    triggers: ["share", "share my card", "qr", "qr code", "nfc", "send my card", "other ways to share", "link in bio", "share link", "how do people get my card"],
    answer:
      "On the dashboard \"Your Card\" panel: tap Share, or \"Other ways to share\" to copy your card link and show/download the QR code (you can put that link in your bio). Your card link is also NFC-ready — write it to any blank NFC tag.",
  },
  {
    triggers: ["swift link", "swift links", "links page", "bio page", "linktree", "link tree", "bio link"],
    answer:
      "Every card has a Swift Links page at swiftcard.me/links/<yourname> — a modern link-in-bio with your photo, bio, social icons, video previews, and custom buttons. Set the bio, socials and extra links in Step 2 when creating or editing a card.",
  },
  {
    triggers: ["contacts", "leads", "my leads", "see contacts", "where are my contacts", "who saved my card", "view contacts"],
    answer:
      "Open \"Contacts\" in the top nav. Everyone who saved your card or sent you their info appears there (defaulting to your selected card; switch cards or pick \"All cards\"). Click a contact for their conversation, notes, status, and follow-up options. Export to CSV from the top.",
  },
  {
    triggers: ["read", "unread", "mark read", "mark as read", "mark unread", "mark as unread", "blue dot"],
    answer:
      "New contacts arrive unread (a blue dot). Toggle read/unread with the envelope button on the contact row, or the \"Mark as read/unread\" button inside the contact. Dashboard notifications also have read/unread, a dismiss (✕), and \"Clear read\".",
  },
  {
    triggers: ["conversation", "message", "they sent", "what they wrote", "their message"],
    answer:
      "Open a contact and use the \"Conversation\" tab to see the message they sent when they reached out, plus their activity (like when they viewed your card). Automated follow-ups will show here too.",
  },
  {
    triggers: ["notification", "notifications", "alerts", "dismiss", "clear read"],
    answer:
      "The bottom of your dashboard shows Notifications by default. Each one can be marked read/unread or dismissed with the ✕, and \"Clear read\" removes the read ones. Use the toggle to switch to List or Pipeline.",
  },
  {
    triggers: ["analytics", "views", "card views", "link views", "stats", "who viewed", "conversion", "top locations", "traffic", "sources"],
    answer:
      "The dashboard analytics widget shows your views with a \"Card views / Link views\" toggle, weekly trends, conversion rate, Today/Best day, and (on Pro) top locations and traffic sources.",
  },
  {
    triggers: ["pricing", "price", "cost", "how much", "free", "pro", "difference between free and pro", "what is pro", "free vs pro"],
    answer:
      "Free includes 1 card and 5 new leads a month (plus 3 AI drafts and 3 card scans a month, all resetting on the 1st). Pro removes those monthly limits — unlimited leads, drafts and scans — and adds unlimited cards, the custom card designer, automated email + text follow-up sequences, full analytics, integrations, and no SwiftCard branding. Upgrade from Settings → Billing, or the Pricing page.",
  },
  {
    triggers: ["upgrade", "go pro", "buy pro", "subscribe"],
    answer:
      "Go to Settings → Billing → \"Change Plan\" (or \"Upgrade to Pro\" if you're on Free), or use the Pricing page. Pro unlocks unlimited cards & contacts, the custom designer, analytics, integrations, and removes branding.",
  },
  {
    triggers: ["billing", "manage subscription", "cancel", "cancel subscription", "invoice", "payment", "change card", "update payment", "refund", "change plan", "keep subscription", "reactivate", "seats", "add seats"],
    answer:
      "Everything is in Settings → Billing. \"Change Plan\" switches between Free, Pro and Office (and monthly/annual). \"Cancel subscription\" schedules it to end at your billing date — you keep Pro until then, and if you change your mind a \"Keep Subscription\" button brings it back. \"Manage subscription & payment\" opens the Stripe portal for your payment method and invoices. Office plans can change seats there too.",
  },
  {
    triggers: ["settings", "where is settings", "account settings", "where are settings"],
    answer:
      "Settings is in the top navigation. Its sections, top to bottom: Your cards, Need help, Integrations, General (email & cards), Billing (your plan and subscription), and Account (which has the Danger Zone for deleting your account).",
  },
  {
    triggers: ["delete account", "close account", "delete my account", "remove account", "reopen", "reopen account", "undo delete", "restore account"],
    answer:
      "Go to Settings → Account → Danger Zone → Delete account (you'll answer a couple of quick questions). After deleting you have 1 month to reopen by logging back in; after that it's permanent. If you only want to stop paying, use Settings → Billing to cancel or switch to Free instead — that keeps your account.",
  },
  {
    triggers: ["integration", "integrations", "zapier", "google contacts", "hubspot", "crm", "sync", "connect crm"],
    answer:
      "Go to Settings → Integrations to connect Zapier or Google Contacts, so new leads sync into your tools automatically (Pro).",
  },
  {
    triggers: ["address", "my address", "location on card", "put my address"],
    answer:
      "Add your address in Step 1 of the card wizard (or the Edit card form). It appears inside your card design and on your card page.",
  },
  {
    triggers: ["logo", "headshot", "photo", "profile picture", "upload image", "upload photo", "company logo"],
    answer:
      "Upload your company logo and headshot in Step 3 of the card wizard (or the Edit form). Logos support square, wide, or banner crops. Each card has its OWN headshot — a card with no headshot won't show one from another card.",
  },
  {
    triggers: ["multiple cards", "more than one card", "switch card", "select a card", "select card", "my cards", "active card", "second card"],
    answer:
      "You can have multiple cards. After logging in you'll pick one on the \"Select a card\" screen (it auto-opens if you only have one). On the dashboard, the \"My Cards\" section lets you switch which card is active.",
  },
  {
    triggers: ["refer", "referral", "refer a friend", "invite", "referral link"],
    answer:
      "Grab your referral link from the dashboard — look for \"Refer a friend\".",
  },
  {
    triggers: ["ai follow up", "ai followup", "generate message", "follow up message", "write a message", "ai message", "follow up", "followup"],
    answer:
      "Open a contact → \"Contact info / Presets\" tab → fill in the notes/context, then use the AI Follow-up generator to draft message ideas you can copy, text, or email.",
  },
  {
    triggers: ["social", "socials", "instagram", "linkedin", "tiktok", "facebook", "youtube", "twitter", "snapchat", "add socials"],
    answer:
      "Add your social links in Step 2 when creating or editing a card — paste a profile URL or type your @handle and it links automatically. They appear on your Swift Links page. For LinkedIn, Facebook, and YouTube, copy the exact format shown under each field.",
  },
  {
    triggers: ["contact support", "email you", "talk to someone", "talk to a human", "support", "contact you", "get help from a person"],
    answer:
      "You can reach the team through the Contact page — there's a link in the footer of the site.",
  },
];

const FALLBACK =
  "I can help with creating & editing cards, designs, sharing, Swift Links, contacts, analytics, notifications, billing, and account settings. Try asking something like \"How do I change my design?\", \"Where are my contacts?\", or \"How do I upgrade to Pro?\" — or reach the team via the Contact page in the footer.";

function normalize(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

// Score each KB entry by matching triggers; multi-word phrases weigh more.
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMessage[] = raw
    .filter((m: unknown): m is ChatMessage =>
      !!m && typeof m === "object" &&
      ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
      typeof (m as ChatMessage).content === "string")
    .slice(-12)
    .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return NextResponse.json({ error: "No question provided." }, { status: 400 });

  // 1) Answer instantly from the built-in knowledge base (free, always works).
  const local = localAnswer(lastUser.content);
  if (local) return NextResponse.json({ reply: local });

  // 2) For anything the KB can't confidently answer, use the LLM IF a provider
  //    is configured. If not (or it errors), fall back to the helpful default.
  if (hasAiProvider()) {
    const convo = messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
    const prompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${convo}\n\nReply as the assistant to the user's last message.`;
    const reply = await aiComplete(prompt, { maxTokens: 700 });
    if (reply) return NextResponse.json({ reply });
  }

  return NextResponse.json({ reply: FALLBACK });
}
