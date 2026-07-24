import { aiComplete, hasAiProvider } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";

const SYSTEM_PROMPT = `You are the in-app help assistant for SwiftCard (swiftcard.me), a digital business card app. You help logged-in users find features and how to do things. Be friendly, concise, and practical with step-by-step directions ("Go to … → click …"). If unsure or it's outside SwiftCard, say so and suggest the Contact page — never invent features.

IMPORTANT: You can ONLY give directions and answer questions. You cannot make any changes, perform actions, edit cards, change settings, send anything, or access or modify the user's account or data. Never claim to have done something for the user. If they ask you to do something, explain the steps so they can do it themselves.

WHAT SWIFTCARD IS
- A digital business card. One account can hold multiple cards. Each card has a card page (swiftcard.me/card/<url>) and a Swift Links page (swiftcard.me/links/<url>) — a link-in-bio with photo, bio, social icons, video previews, and custom buttons.
- Free (monthly meters that reset on the 1st): 1 card, 5 new leads/month, 3 AI drafts/month, all templates, 2 additional Swift Links buttons, basic analytics (views & best day), a Day-1 follow-up email, the standard dark Swift Links page, and a "Powered by SwiftCard" badge. Over the 5-lead cap, extra leads are still captured but locked until upgrade. The AI business-card scanner is NOT on Free — it's a Pro feature. Pro: unlimited leads/drafts, unlimited cards, AI business-card scanner, custom card designer, Social design (style your Swift Links page — background, text color & font), automated email + text follow-up sequences (Light/Medium/Aggressive), premium Swift Links (video previews, featured tiles), full who/when/where analytics, CSV export, integrations (Zapier, Google, HubSpot), no SwiftCard branding on your pages or automated emails/texts. Office = everything in Pro for each seat, $1/user cheaper, min 2 seats, with an admin console: company branding (logo, contact info, design + optional design lock) applied to every team card, passwordless invites (Google or email link), per-person analytics.

KEY PLACES
- Dashboard: pick a card, see analytics (Card/Link views toggle), and the bottom section (Notifications default / List / Pipeline). "Your Card" panel has Share + "Other ways to share" (link + QR).
- Create a card: dashboard "+ Add card" → 4 steps (1 Card information: name, title, phones, email, website, address → 2 Card design: logo, headshot, template, colors → 3 Socials: bio, social profiles, additional links → 4 Social design: style your Swift Links page).
- Edit a card: My Cards → Edit, or Settings → Your cards → Edit. Tabs: Card info, Card design (photos + templates + Pro custom designer), Socials, Social design (Swift Links page look).
- Contacts: everyone who saved your card or messaged you; read/unread, conversation, notes, status, AI follow-up, SMS, export.
- Settings: Your cards, Need help, Integrations, General (email/cards), Billing (change plan, cancel, keep subscription, seats, payment method), Account → Danger Zone (delete + 1-month reopen).

Keep answers short. Use plain language.`;

// Hard guardrail appended to the prompt ONLY for native-app sessions. The app
// store forbids in-app selling, so the assistant must never route users toward
// buying, pricing, or the website. If asked how to get a feature, it states only
// which plan includes it.
export const NATIVE_RULES = `

IMPORTANT — NATIVE APP SESSION: You must NEVER discuss upgrading, pricing, prices, costs, discounts, purchasing, payments, subscriptions, or billing, and you must NEVER tell the user to visit the website, the Pricing page, or Settings → Billing. If the user asks how to get a feature or how to "upgrade", answer ONLY by stating which plan includes it (e.g. "That feature is part of the Pro plan.") — say nothing about how to buy it, what it costs, or where to pay. Do not use the word "upgrade".`;

// ── Built-in knowledge base (works with no API / no credits) ────────────────
// `nativeAnswer` overrides `answer` in native-app sessions for entries whose
// normal answer would leak pricing/upgrade/billing/website copy — so the KB
// fast-path can't bypass the native guardrail above.
type KbEntry = { triggers: string[]; answer: string; nativeAnswer?: string };

const KB: KbEntry[] = [
  {
    triggers: ["hello", "hi", "hey", "what can you do", "what can you help", "help me"],
    answer:
      "Hi! I can help you find features and learn how to do things in SwiftCard. Try asking things like \"How do I create a card?\", \"How do I share my card?\", \"Where are my contacts?\", or \"How do I upgrade to Pro?\"",
    nativeAnswer:
      "Hi! I can help you find features and learn how to do things in SwiftCard. Try asking things like \"How do I create a card?\", \"How do I share my card?\", or \"Where are my contacts?\"",
  },
  {
    triggers: ["create a card", "make a card", "new card", "add card", "add a card", "create my card", "get started", "first card", "set up a card"],
    answer:
      "From your dashboard, click \"+ Add card\" (or the big \"Create your card\" button if you don't have one yet). It's a quick 4-step wizard: 1) Card information — your details, address & website, 2) Card design — logo, headshot & template, 3) Socials — bio, social links & extra buttons, 4) Social design — style your Swift Links page.",
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
      "Every card has a Swift Links page at swiftcard.me/links/<yourname> — a modern link-in-bio with your photo, bio, social icons, video previews, and custom buttons. Set the bio, socials and extra links in the Socials step (step 3) when creating a card, or the Socials tab when editing — and style the page (background, color & font) in Social design (Pro).",
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
      "Free includes 1 card, 5 new leads a month and 3 AI drafts a month (the monthly ones reset on the 1st). Pro removes those limits — unlimited leads and drafts — and adds unlimited cards, the AI business-card scanner, the custom card designer, automated email + text follow-up sequences, full analytics, integrations, and no SwiftCard branding. Upgrade from Settings → Billing, or the Pricing page.",
    nativeAnswer:
      "Free includes 1 card, 5 new leads a month and 3 AI drafts a month (the monthly ones reset on the 1st). Unlimited leads and drafts, unlimited cards, the AI business-card scanner, the custom card designer, automated email + text follow-up sequences, full analytics, and integrations are all part of the Pro plan.",
  },
  {
    triggers: ["upgrade", "go pro", "buy pro", "subscribe"],
    answer:
      "Go to Settings → Billing → \"Change Plan\" (or \"Upgrade to Pro\" if you're on Free), or use the Pricing page. Pro unlocks unlimited cards & contacts, the custom designer, analytics, integrations, and removes branding.",
    nativeAnswer:
      "Unlimited cards & contacts, the custom designer, full analytics, and integrations are part of the Pro plan.",
  },
  {
    triggers: ["billing", "manage subscription", "cancel", "cancel subscription", "invoice", "payment", "change card", "update payment", "refund", "change plan", "keep subscription", "reactivate", "seats", "add seats"],
    answer:
      "Everything is in Settings → Billing. \"Change Plan\" switches between Free, Pro and Office (and monthly/annual). \"Cancel subscription\" schedules it to end at your billing date — you keep Pro until then, and if you change your mind a \"Keep Subscription\" button brings it back. \"Manage subscription & payment\" opens the Stripe portal for your payment method and invoices. Office plans can change seats there too.",
    nativeAnswer:
      "That isn't something I can help with in the app. I can still help with cards, contacts, sharing, Swift Links, analytics, and account settings — just ask.",
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
    nativeAnswer:
      "Go to Settings → Account → Danger Zone → Delete account (you'll answer a couple of quick questions). After deleting you have 1 month to reopen by logging back in; after that it's permanent.",
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
    triggers: ["logo", "headshot", "photo", "profile picture", "upload image", "upload photo", "company logo", "suggest headshot", "suggest my headshot"],
    answer:
      "Upload your company logo and headshot in Step 3 of the card wizard (or the Edit form). Don't have a photo handy? Tap \"Suggest my headshot\" under the headshot field and we'll pull one from your Google account, Gravatar, or your connected LinkedIn — preview it and choose to use it. Logos support square, wide, or banner crops. Each card has its OWN headshot — a card with no headshot won't show one from another card.",
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

// ── Office Admin console assistant ──────────────────────────────────────────
// A SEPARATE scope for the floating helper on /office/admin/*. It knows the
// admin console cold — the four tabs and every action inside them — and answers
// "where do I find / how do I do X" for an office owner or admin. Everything it
// describes is a place in the console; it never performs actions.
const OFFICE_ADMIN_SYSTEM_PROMPT = `You are the Admin Console assistant for SwiftCard's Office plan. The user is an office owner or admin looking at the Admin console (/office/admin). Help them find things and do things IN THE ADMIN CONSOLE. Be friendly, concise, and give step-by-step directions ("Go to the … tab → click …"). If a question is about their own personal card (not the admin console), briefly answer, but you specialize in the console. Never invent features; if unsure, suggest the Contact page in the site footer.

IMPORTANT: You can ONLY give directions and answer questions — you cannot make changes, invite anyone, edit cards, change branding, or touch the account. Never claim to have done something. If asked to do something, explain the steps so they can do it themselves.

THE ADMIN CONSOLE LAYOUT
- Reach it from your own dashboard → the "Admin" tab (or /office/admin). The header shows "SwiftCard · Admin · <your office name>" and a "← My dashboard" link back to your personal side. There are FOUR tabs: Team, Analytics, Leads, Branding.
- A "Tour" button on the Team page replays a short guided walkthrough of the console anytime.

TEAM TAB (the landing page, /office/admin)
- Setup checklist at the top (brand your cards, invite your team, etc.) that ticks off as you complete each step.
- Four headline numbers: Leads captured, Card views, how many invited teammates finished their card (activation), and Seats used vs. seats you're paying for.
- "Add a team member" button — invite someone by email. They get a passwordless link (sign in with Google or a one-tap email link); their card is pre-branded with your company look. Invites expire in 14 days. If you're out of seats it offers to add a seat first.
- Roster: everyone who has a company card, plus anyone invited who hasn't finished yet ("Invited / not finished"). Click "Manage" on a person to open their panel — see/Edit their card, Resend their invite, show their card QR, or Remove them from the team.

ANALYTICS TAB (/office/admin/analytics)
- Whole-team performance with a date-range selector. Stat tiles: Card views, Unique visitors, Card/QR scans, Leads captured, Contacts saved, SwiftLink views, and Conversion rate. Below: a "Views over time" chart, "Traffic sources", and "Team performance" — a per-employee breakdown of who's driving real engagement and leads.

LEADS TAB (/office/admin/leads)
- One combined list of every lead captured across the WHOLE team — who they are, which teammate's card they came from, and when. Nothing is lost when someone leaves. Export the list from the top of the table.

BRANDING TAB (/office/admin/branding)
- Set the one look every teammate's card shares: company logo, company name, website, office contact info (phone, fax, address), plus the card design (template, colors, fonts). Turn on the design lock to force the uniform look, or leave it off to let teammates pick their own template/colors.
- Branding lives on the office and applies to your TEAMMATES' cards. Your OWN personal card stays yours — editing your card doesn't get overwritten by the office brand, and the office brand governs sub-users only. Saving Branding re-applies the look to every active teammate's card automatically.

ROLES & PERMISSIONS
- The office OWNER can do everything. You can give a teammate a role: Admin (invite/remove members, manage branding, edit member cards, view analytics), Manager (view analytics only), Billing admin (billing, seats, analytics), or Employee (their own card only). Only the owner assigns roles.

BILLING & SEATS
- Plan, payment method, invoices, and seat count live in Settings → Billing (on your personal side — use "← My dashboard", then Settings → Billing). Office needs at least 2 seats. You can also add a seat on the spot when inviting past your current seat count.`;

const OFFICE_ADMIN_KB: KbEntry[] = [
  {
    triggers: ["hello", "hi", "hey", "what can you do", "what can you help", "help me", "get started"],
    answer:
      "Hi! I'm your Admin Console assistant. Ask me where to find things or how to do them in your Office admin — e.g. \"How do I invite a teammate?\", \"Where do I set our company branding?\", \"Where are all our leads?\", or \"How do I see per-person analytics?\"",
  },
  {
    triggers: ["invite", "invite a member", "invite teammate", "invite employee", "add a member", "add member", "add teammate", "add employee", "add someone", "onboard", "send invite"],
    answer:
      "On the Team tab (the admin landing page), click \"Add a team member\" and enter their email. They get a passwordless invite — they sign in with Google or a one-tap email link and their card is already branded with your company look. Invites expire in 14 days. If you're out of seats it'll offer to add one first.",
    nativeAnswer:
      "On the Team tab (the admin landing page), tap \"Add a team member\" and enter their email. They get a passwordless invite — Google or a one-tap email link — and their card comes pre-branded with your company look. Invites expire in 14 days.",
  },
  {
    triggers: ["resend", "resend invite", "invite again", "they didn't get", "didnt get the invite", "send invite again", "pending invite", "not finished", "hasn't finished", "havent finished"],
    answer:
      "On the Team tab, find the person in the roster (invited people show as \"not finished\"), click \"Manage\", then \"Resend invite\" to send the link again. You can also copy the invite link to send it yourself.",
  },
  {
    triggers: ["remove", "remove member", "remove teammate", "remove employee", "delete member", "take someone off", "someone left", "offboard", "suspend"],
    answer:
      "On the Team tab, click \"Manage\" on the person, then \"Remove\". Their leads stay with the office (nothing is lost), and your company logo/branding is stripped from the card they walk away with. Removing frees up their seat.",
  },
  {
    triggers: ["branding", "logo", "company logo", "company name", "brand", "our look", "company look", "set branding", "upload logo", "change logo", "company info", "office contact", "company address", "company phone"],
    answer:
      "Open the Branding tab. There you set your company logo, company name, website, and office contact info (phone, fax, address), plus the card design (template, colors, fonts). Saving applies the look to every teammate's card automatically. Your own personal card stays yours.",
  },
  {
    triggers: ["design lock", "lock design", "lock template", "force design", "uniform", "stop employees changing", "let employees pick", "unlock design"],
    answer:
      "On the Branding tab there's a design lock. Turn it ON to force one uniform template/colors/fonts across every teammate's card; leave it OFF to let each teammate pick their own template and colors (your company logo, name, and contact info stay company-controlled either way).",
  },
  {
    triggers: ["analytics", "stats", "performance", "views", "card views", "who is performing", "per person", "per employee", "team performance", "conversion", "traffic sources", "scans", "leads captured"],
    answer:
      "Open the Analytics tab. Pick a date range, then see whole-team tiles (Card views, Unique visitors, Card/QR scans, Leads captured, Contacts saved, SwiftLink views, Conversion rate), a Views-over-time chart, Traffic sources, and a per-employee \"Team performance\" breakdown.",
  },
  {
    triggers: ["leads", "our leads", "team leads", "all leads", "see leads", "where are the leads", "who contacted", "export leads", "download leads", "csv"],
    answer:
      "Open the Leads tab — it's one combined list of every lead captured across your whole team, showing who they are, which teammate's card they came from, and when. Export the list from the top of the table. Leads stay with the office even if the person who captured them leaves.",
  },
  {
    triggers: ["seats", "add seats", "add a seat", "seat count", "how many seats", "buy seats", "more seats", "out of seats", "no seats", "remove seat"],
    answer:
      "Seats are managed in Settings → Billing (on your personal side — use \"← My dashboard\", then Settings → Billing). You can also add a seat on the spot when you invite someone past your current seat count. Office needs at least 2 seats.",
    nativeAnswer:
      "You can add a seat on the spot when you invite someone past your current seat count — the invite dialog offers it. Office needs at least 2 seats.",
  },
  {
    triggers: ["billing", "payment", "invoice", "change plan", "cancel", "manage subscription", "update card", "receipt", "subscription"],
    answer:
      "Billing lives on your personal side: click \"← My dashboard\" in the admin header, then go to Settings → Billing to change plan, update your payment method, see invoices, or manage seats.",
    nativeAnswer:
      "That isn't something I can help with in the app. I can still help you with the Team, Analytics, Leads, and Branding tabs of your admin console — just ask.",
  },
  {
    triggers: ["role", "roles", "make admin", "assign role", "permission", "permissions", "manager", "billing admin", "give access", "make someone admin"],
    answer:
      "The office owner can give teammates roles: Admin (invite/remove members, manage branding, edit member cards, view analytics), Manager (analytics only), Billing admin (billing/seats/analytics), or Employee (their own card only). Only the owner assigns roles.",
  },
  {
    triggers: ["edit member card", "edit someone card", "edit employee card", "manage member card", "fix their card", "change their card", "take card offline"],
    answer:
      "On the Team tab, click \"Manage\" on the person, then \"Edit card\" to view or adjust their company card (available to the owner and Admins).",
  },
  {
    triggers: ["tour", "walkthrough", "guided", "show me around", "replay tour"],
    answer:
      "Click the \"Tour\" button on the Team page for a short guided walkthrough of the Team, Analytics, Leads, and Branding tabs. You can replay it anytime.",
  },
  {
    triggers: ["back to dashboard", "my own card", "my dashboard", "personal", "leave admin", "exit admin"],
    answer:
      "Use the \"← My dashboard\" link in the top-left of the admin header to go back to your personal side (your own card, contacts, and Settings).",
  },
  {
    triggers: ["contact support", "talk to someone", "talk to a human", "support", "contact you", "get help from a person"],
    answer:
      "You can reach the team through the Contact page — there's a link in the footer of the site.",
  },
];

const OFFICE_ADMIN_FALLBACK =
  "I'm your Admin Console assistant. I can help you find things in the Team, Analytics, Leads, and Branding tabs — like inviting a teammate, setting company branding, seeing per-person analytics, or exporting your team's leads. Try asking \"How do I invite someone?\" or \"Where do I set our branding?\" — or reach the team via the Contact page in the footer.";

const OFFICE_ADMIN_NATIVE_FALLBACK =
  "I'm your Admin Console assistant. I can help you find things in the Team, Analytics, Leads, and Branding tabs — like inviting a teammate, setting company branding, seeing per-person analytics, or exporting your team's leads. Try asking \"How do I invite someone?\" or \"Where do I set our branding?\"";

// Native-safe fallback: same helpfulness, no upgrade/billing/website copy.
export const NATIVE_FALLBACK =
  "I can help with creating & editing cards, designs, sharing, Swift Links, contacts, analytics, notifications, and account settings. Try asking something like \"How do I change my design?\", \"Where are my contacts?\", or \"How do I share my card?\"";

function normalize(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

// Score each KB entry by matching triggers; multi-word phrases weigh more.
// In native sessions, an entry's `nativeAnswer` (when present) is returned in
// place of `answer` so the fast-path can't leak pricing/upgrade/billing copy.
export function localAnswer(question: string, native = false, kb: KbEntry[] = KB): string | null {
  const q = normalize(question);
  let best: { score: number; entry: KbEntry | null } = { score: 0, entry: null };
  for (const entry of kb) {
    let score = 0;
    for (const t of entry.triggers) {
      const words = t.split(" ").length;
      if (q.includes(` ${t} `) || (words > 1 && q.includes(t))) score += words;
    }
    if (score > best.score) best = { score, entry };
  }
  if (best.score < 1 || !best.entry) return null;
  return native ? best.entry.nativeAnswer ?? best.entry.answer : best.entry.answer;
}

// Build the LLM prompt; appends the hard native guardrail for native sessions.
// `system` swaps the base prompt so the office-admin scope gets its own persona.
export function buildHelpPrompt(convo: string, native = false, system: string = SYSTEM_PROMPT): string {
  return `${system}${native ? NATIVE_RULES : ""}\n\nConversation so far:\n${convo}\n\nReply as the assistant to the user's last message.`;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Per-user throttle: authenticated but previously uncapped (cost/abuse guard).
  if (await isRateLimited(`ai-help:${user.id}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests — please wait a moment and try again." }, { status: 429 });
  }


  const body = await req.json().catch(() => ({}));
  const native = body.native === true;
  // `area` scopes the assistant. "office-admin" gives the admin-console persona +
  // KB (with the general KB as a fallback so an admin's personal-card questions
  // still get instant answers); anything else is the default app assistant.
  const isAdmin = body.area === "office-admin";
  const kb = isAdmin ? [...OFFICE_ADMIN_KB, ...KB] : KB;
  const systemPrompt = isAdmin ? OFFICE_ADMIN_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const fallback = isAdmin
    ? (native ? OFFICE_ADMIN_NATIVE_FALLBACK : OFFICE_ADMIN_FALLBACK)
    : (native ? NATIVE_FALLBACK : FALLBACK);
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
  //    Native sessions get the native-safe answer for any leaky entry.
  const local = localAnswer(lastUser.content, native, kb);
  if (local) return NextResponse.json({ reply: local });

  // 2) For anything the KB can't confidently answer, use the LLM IF a provider
  //    is configured. If not (or it errors), fall back to the helpful default.
  if (hasAiProvider()) {
    const convo = messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
    const prompt = buildHelpPrompt(convo, native, systemPrompt);
    const reply = await aiComplete(prompt, { maxTokens: 700 });
    if (reply) return NextResponse.json({ reply });
  }

  return NextResponse.json({ reply: fallback });
}
