import { defineDocs } from "../types";

// Settings, billing, and the account lifecycle.
//
// This is where the old assistant was most wrong: it recited a Settings menu
// from before the sections were regrouped, and sent people to a "Danger Zone"
// that no longer exists anywhere in the product.

export const accountDocs = defineDocs([
  {
    id: "settings-map",
    title: "Where Settings is and what's in it",
    audience: ["user", "office-admin"],
    triggers: [
      "settings", "where is settings", "account settings", "where are settings",
      "preferences", "options", "configure",
    ],
    answer:
      "Settings is the gear icon at the top right of the app (or the \"Settings\" tab in the mobile bottom bar) — it opens /settings/flows. Its sections, in order: Profile, Cards and sharing, Plan and billing, Notifications and preferences, Security, Help and referrals, and Advanced account settings. One section opens at a time.",
    detail:
      "Watch out for old names — there is NO section called Billing, Integrations, General, Account, or Danger Zone. In particular: CRM integrations live inside \"Notifications and preferences\", not in a section of their own; account deletion is under \"Advanced account settings\"; the plan lives under \"Plan and billing\". \"Cards and sharing\" is the only place a card can be edited. Section descriptions: Profile — \"Your account details at a glance.\" Cards and sharing — \"Edit, open, or remove a card, and share your links.\" Plan and billing — \"Your plan, seats, invoices and payment method.\" Security — password and sign out. Advanced account settings — \"Account ownership and deletion. Deleting is permanent.\"",
    commerce: true,
    nativeAnswer:
      "Settings is the gear icon at the top right of the app (or the \"Settings\" tab in the bottom bar). Its sections: Profile, Cards and sharing, Notifications and preferences, Security, Help and referrals, and Advanced account settings. One section opens at a time.",
  },
  {
    id: "profile-and-email",
    title: "Your account email, and changing it",
    audience: ["user"],
    triggers: [
      "change my email", "change email", "account email", "login email", "wrong email",
      "my profile", "email address",
    ],
    answer:
      "Settings → Profile shows your account email, how many cards you have, and your plan — all read-only. There's no self-serve way to change the email you sign in with; contact the team through the Contact page for that.",
    detail:
      "Don't confuse the two emails. The sign-in email is fixed and lives on the account. The email printed on a card is a separate, per-card field edited in the card editor's \"Card info\" tab, and it is completely normal for them to differ.",
  },
  {
    id: "password-and-security",
    title: "Passwords, signing out, and 2FA",
    audience: ["user"],
    triggers: [
      "password", "change password", "reset password", "forgot password", "new password",
      "sign out", "log out", "logout", "two factor", "2fa", "security",
    ],
    answer:
      "Settings → Security has two rows: \"Password\" with a \"Change password\" link, and \"Sign out\" for this device. If you've forgotten your password, use \"Forgot password?\" on the sign-in screen — type your email in the box first, then tap the link.",
    detail:
      "Changing the password from Settings does not ask for the current one; it takes you to the set-a-new-password page with your existing session. There is no two-factor authentication, no session list, and no API keys anywhere in the product — say so plainly rather than hunting for a setting. An account created with Google or Apple has no password at first, but running a password reset will set one, which then also allows email + password sign-in.",
  },
  {
    id: "plan-and-billing",
    title: "Your plan, invoices, and payment method",
    audience: ["user"],
    triggers: [
      "billing", "invoice", "invoices", "receipt", "payment", "payment method",
      "change card", "update payment", "my plan", "what plan am i on", "charge",
    ],
    answer:
      "Settings → Plan and billing shows your current plan, what you pay, and the renewal date. \"Manage subscription & payment\" opens the subscription panel, where you can switch plan or billing interval, and from there reach the Stripe portal for your payment method and invoices.",
    detail:
      "Two buttons carry the same \"Manage subscription & payment\" label — the one on the panel opens SwiftCard's own modal, and the one inside that modal opens the Stripe billing portal. The plan switcher offers Monthly / Annual (annual saves about 10%) and lets a Pro account move to Office or back. You cannot move to Free from the plan rows — that is a cancellation. Downgrades come back as credit on the next invoice, never a cash refund. Office accounts also get a \"Team seats\" block here.",
    commerce: true,
    nativeAnswer:
      "That isn't something I can help with in the app. I can still help with cards, contacts, sharing, Swift Links, analytics, notifications, and account settings — just ask.",
  },
  {
    id: "upgrade",
    title: "Plan prices and getting Pro or Office",
    audience: ["user"],
    triggers: [
      "upgrade", "go pro", "buy pro", "subscribe", "get pro", "unlock", "how do i pay",
      "pricing", "price", "cost", "how much", "plans", "what is pro", "free vs pro",
      "difference between free and pro", "whats included in pro", "what do i get with pro",
    ],
    answer:
      "Pro is {price.proMonthly} a month (or {price.proAnnual} a year, about 10% off) and takes every Free limit off — unlimited cards and contacts, the business-card scanner, the custom designer, automated follow-ups, full analytics and the CRM integrations. Office is {price.officeMonthly} per seat per month for a team. Settings → Plan and billing → \"Upgrade →\", or the /upgrade page, shows both side by side, and you see an order summary before anything is charged.",
    detail:
      "Subscribing to Pro starts with a {trial.days}-day free trial if you've never subscribed before — a card is taken at checkout and billing starts when the trial ends. Office never includes a trial. If you already have a subscription, changing plan swaps the price on your existing subscription rather than creating a second one, so you are never double-charged, and the proration you're quoted is the amount you're charged.",
    commerce: true,
    nativeAnswer:
      "Unlimited cards and contacts, the AI business-card scanner, the custom card designer, automated email and text follow-up sequences, full analytics, and the CRM integrations are all part of the Pro plan. Office adds shared company branding and the admin console for a team.",
  },
  {
    id: "cancel-subscription",
    title: "Cancelling, and undoing a cancellation",
    audience: ["user"],
    triggers: [
      "cancel", "cancel subscription", "stop paying", "downgrade", "switch to free",
      "end subscription", "keep subscription", "reactivate", "undo cancel",
    ],
    answer:
      "Settings → Plan and billing → \"Manage subscription & payment\" → \"Switch to Free\". You'll be asked why, then it schedules the cancellation for the end of the period you've already paid for — you keep everything until then. While it's pending, a green \"Keep Subscription\" button appears if you change your mind.",
    detail:
      "Nothing is deleted when a plan ends. Extra cards go offline (their public pages stop loading, so QR codes and NFC cards pointing at them stop working), follow-up sequences pause, over-cap contacts get hidden rather than removed, and Pro colours and extra Swift Links stay stored. Re-subscribing switches it all back on. The \"Keep Subscription\" button only exists while a cancellation is actually pending — don't promise it to someone who hasn't cancelled.",
    commerce: true,
    nativeAnswer:
      "That isn't something I can help with in the app. I can still help with cards, contacts, sharing, Swift Links, analytics, notifications, and account settings — just ask.",
  },
  {
    id: "failed-payment",
    title: "A payment that didn't go through",
    audience: ["user"],
    triggers: [
      "payment failed", "card declined", "declined", "past due", "grace period",
      "payment didn't work", "lost pro",
    ],
    answer:
      "If a renewal fails, Settings → Plan and billing shows an amber \"Your last payment didn't go through.\" banner and you keep full access during a short grace period. Update the payment method from that panel and the plan continues as normal.",
    detail:
      "Only a failed RENEWAL starts the grace period; a failed one-off or proration charge doesn't. If retries are exhausted the account moves to Free — again with nothing deleted.",
    commerce: true,
    nativeAnswer:
      "If a renewal doesn't go through you keep full access for a short grace period while the card on file is sorted out. That isn't something I can help with in the app — but I can still help with cards, contacts, sharing, analytics and settings.",
  },
  {
    id: "office-seats",
    title: "Team seats",
    audience: ["user", "office-admin"],
    triggers: [
      "seats", "add seats", "add a seat", "seat count", "how many seats", "buy seats",
      "more seats", "out of seats", "no seats", "remove seat", "reduce seats",
    ],
    answer:
      "Settings → Plan and billing → \"Team seats\". The stepper shows how many you've bought versus how many are in use, and adding seats takes effect immediately. You can also add a seat on the spot when you invite someone past your current count. Office needs at least {limit.seats} seats.",
    detail:
      "Seats in use = you + active members + pending invitations, and you can't reduce below that — remove members or revoke invitations first. Reductions are scheduled for the end of the billing period rather than applied immediately; increases are invoiced right away. Expired invitations stop holding a seat.",
    commerce: true,
    nativeAnswer:
      "You can add a seat on the spot when you invite someone past your current seat count — the invite dialog offers it. Office needs at least {limit.seats} seats, and seats in use means you, plus active members, plus pending invitations.",
  },
  {
    id: "integrations",
    title: "CRM integrations and Zapier",
    audience: ["user"],
    triggers: [
      "integration", "integrations", "zapier", "google contacts", "hubspot", "pipedrive",
      "gohighlevel", "highlevel", "ghl", "crm", "sync", "connect crm", "webhook", "api",
    ],
    answer:
      "They're in Settings → Notifications and preferences, under \"Send contacts to your CRM\" — not in a section of their own. Connect GoHighLevel, Pipedrive, HubSpot or Google Contacts and new leads sync automatically; a Zapier webhook below them covers everything else. Integrations are a Pro feature.",
    detail:
      "Three of the four are token-paste rather than OAuth: GoHighLevel wants a Private Integration token plus a Location ID, Pipedrive wants a personal API token, HubSpot wants a private-app token. Only Google Contacts uses a Connect button and an OAuth redirect. Tokens are checked against the provider before saving, so a bad one is rejected immediately with a message naming that provider. Once a connection exists, a \"Sending from …\" line with a \"Change\" link lets you pick which cards feed it (that picker doesn't appear on a single-card account). The Zapier box only accepts a real hooks.zapier.com catch-hook URL. There is no public SwiftCard API and no API keys.",
  },
  {
    id: "notifications-and-emails",
    title: "Push notifications and email preferences",
    audience: ["user"],
    triggers: [
      "push", "push notification", "notifications settings", "turn on notifications",
      "marketing emails", "stop emails", "email preferences", "receipts", "unsubscribe",
    ],
    answer:
      "Settings → Notifications and preferences. The push switch at the top turns on instant alerts when someone shares their info — it's per device, so turn it on wherever you want alerts. Below it, \"Marketing emails\" and \"Payment receipts\" have their own switches; press \"Save preferences\" to apply them.",
    detail:
      "The email switches are NOT auto-saved — a common complaint is that the toggle looked flipped but nothing changed, which means \"Save preferences\" was never pressed. Every marketing email also carries an unsubscribe link that lands on /unsubscribe and works without signing in. Payment receipts and other transactional mail keep sending regardless.",
  },
  {
    id: "ai-features-consent",
    title: "AI features and your data (permission switch)",
    audience: ["user"],
    triggers: [
      "ai consent", "ai permission", "allow ai", "turn off ai", "ai features",
      "ai privacy", "what does ai see", "where does my data go", "google ai",
      "gemini", "disable ai", "ai settings",
    ],
    answer:
      "In the iPhone app, SwiftCard asks permission before any AI feature runs, and the standing switch lives at Settings \u2192 Notifications and preferences \u2192 \"AI features\". While it's off (or before you've answered), nothing is sent to the AI provider \u2014 the card scanner and AI drafts wait, and the in-app assistant answers from its built-in knowledge instead.",
    detail:
      "What gets sent when AI is allowed: the photo you take when scanning a business card, a contact's name, company, where you met and your notes when AI writes a follow-up, and messages you type to the assistant \u2014 sent to the AI provider to produce the result and to no one else. Saying no turns AI features off without affecting anything else. A decline made in the app is honoured on the website too. The privacy details live at swiftcard.me/privacy.",
  },
  {
    id: "delete-account",
    title: "Deleting your account, and getting it back",
    audience: ["user"],
    triggers: [
      "delete account", "close account", "delete my account", "remove account",
      "reopen", "reopen account", "undo delete", "restore account", "cancel deletion",
    ],
    answer:
      "Settings → Advanced account settings → \"Account ownership and deletion\" → \"Delete account\". You pick a reason, then confirm. It's a soft delete: for 30 days you can sign back in and press \"Reopen my account\" with everything intact. After that it's purged permanently and cannot be restored.",
    detail:
      "There is no \"Danger Zone\" and no section called \"Account\" — those names are gone. Deleting cancels any active subscription. Signing in during the window lands you on the /account-deleted screen with the reopen button and a count of days left. If someone only wants to stop paying, cancelling in Plan and billing keeps the account and its data. An office owner gets an extra warning, because deleting ends the team's subscription for everyone.",
    commerce: true,
    nativeAnswer:
      "Settings → Advanced account settings → \"Account ownership and deletion\" → \"Delete account\". You pick a reason, then confirm. For 30 days you can sign back in and press \"Reopen my account\" with everything intact; after that it is permanent and cannot be restored.",
  },
  {
    id: "referrals",
    title: "Referring friends and earning free months",
    audience: ["user"],
    triggers: [
      "refer", "referral", "refer a friend", "invite a friend", "referral link",
      "free month", "earn free", "promo code", "discount code",
    ],
    answer:
      "Settings → Help and referrals has your \"Refer a friend\" box. Invite 3 friends who sign up and you get a month of Pro free, up to 3 months — and your friends get a free month too. There's more at /grow.",
    detail:
      "Rewards never switch themselves on: when one is earned you have to press Claim. Only a real referral link earns the month — the other \"create a free account\" prompts scattered around the product (the badge on a card, a follow-up email) are not referral links. Each free month lasts {limit.freeMonthDays} days.",
    commerce: true,
    nativeAnswer:
      "Settings → Help and referrals has your \"Refer a friend\" box. Invite 3 friends who sign up and you earn a month of Pro free, up to 3 months; your friends get a free month too. Rewards are not automatic — press Claim when one is earned.",
  },
  {
    id: "plan-limits-explained",
    title: "What happens when you hit a Free limit",
    audience: ["user"],
    triggers: [
      "limit", "limits", "cap", "locked leads", "locked", "hit my limit", "blurred",
      "why cant i", "why can't i add", "maxed out", "free plan limits",
    ],
    answer:
      "Free includes {limit.cards} card, {limit.leads} new contacts a month, {limit.drafts} AI follow-up drafts a month, and {limit.links} extra Swift Links buttons. The monthly counters reset on the 1st and count per account, so deleting a card doesn't reset them. Contacts captured past the cap are still captured — they're just hidden until the account is on a paid plan.",
    detail:
      "That last point matters and people get it wrong: nothing is thrown away at the cap. Over-cap contacts appear blurred with a \"locked\" note and unlock the moment the account becomes paid. The same is true after a downgrade — extra Swift Links buttons and Pro colours stay stored and hidden rather than deleted. The AI business-card scanner has no free allowance at all; it is Pro-only from the first scan.",
  },
]);
