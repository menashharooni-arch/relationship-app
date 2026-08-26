import { defineDocs } from "../types";

// The public site: what a visitor can reach without an account, and the honest
// answers to the questions visitors actually ask before signing up.

export const marketingDocs = defineDocs([
  {
    id: "site-map",
    title: "What's on the website",
    audience: ["visitor"],
    triggers: ["what pages", "site map", "where do i find", "menu", "navigation", "more info"],
    answer:
      "The homepage hero (desktop) rotates six example professionals — realtor, electrician, insurance agent, banker, lawyer, car salesperson — each shown three ways at once: their SwiftCard in a phone in the center, their Swift Links page on the left, and their Swift Signature on the right. The site covers: pricing at swiftcard.me/pricing, a live demo at swiftcard.me/preview, the card designs at swiftcard.me/templates, use cases at swiftcard.me/testimonials, and product pages under swiftcard.me/products/ (digital cards, SwiftLinks, Swift Signature, lead capture, analytics, teams, ways to share, Apple Watch, integrations), plus industry pages under swiftcard.me/for/. The footer carries Product, Solutions and \"Who it's for\" link columns, Preview, Templates, Why SwiftCard, Contact Us, and swiftcard.me/company, swiftcard.me/privacy, swiftcard.me/terms and swiftcard.me/sms-terms.",
    detail:
      "Nav layout: Home, a Products menu (Digital Cards, SwiftLinks, Swift Signature, Lead Capture), a Solutions menu (Dashboard & Analytics, Teams & Offices, Ways to share, Apple Watch, Integrations), a Resources menu (Preview, Templates, Why SwiftCard, Contact Us, Privacy), then Pricing, Log in, and Get started free. /testimonials is labelled \"Why SwiftCard\" in the menus. There is also a comparison page at swiftcard.me/compare that is not linked from the nav. Note that swiftcard.me/share, swiftcard.me/grow and swiftcard.me/upgrade are NOT public marketing pages — they need an account and will send a signed-out visitor to the login screen.",
  },
  {
    id: "try-before-signup",
    title: "Trying it without an account",
    audience: ["visitor"],
    triggers: [
      "try it", "demo", "see it", "test it", "without signing up", "before i sign up",
      "do i need an account", "live demo", "preview",
    ],
    answer:
      "Two ways, both free and account-free. swiftcard.me/preview is the real app loaded with sample data — click around the dashboard, contacts and links. And swiftcard.me/cards/new lets you build your actual card first; you only make an account at the end, when you save it.",
    detail:
      "Everything on /preview is demo data — the view counts and contacts there belong to nobody, and it cannot be logged into. In the builder, a card built as a guest lives in your browser as a draft and is not stored on our servers until you pick a plan and create the account. Going back to the homepage clears that draft.",
  },
  {
    id: "getting-started-visitor",
    title: "Getting started",
    audience: ["visitor"],
    triggers: ["get started", "sign up", "signup", "create a card", "start", "how do i begin", "make a card"],
    answer:
      "Go to swiftcard.me/cards/new and build your card — there's no login wall. Quickest start: on the homepage, type your name into the SwiftCard.me/\"full name\" box and press \"Start for free\" — the builder opens with your name already filled in. It's four steps: Card information, Card design, Socials, then Social design. At the end you choose a plan and create your account, and your card goes live.",
    detail:
      "The steps in order: 1 \"New card\" (name, title, phones, email, website, address) → \"Next: Card design →\"; 2 Card design (logo, headshot, template, colours) → \"Next: Socials →\"; 3 Socials (bio, social profiles, extra link buttons) → \"Next: Social design →\"; 4 Social design (style the Swift Links page) → \"Continue to plans →\", which opens \"Choose your plan\". Picking Free (\"Start free →\") creates the account and publishes the card.",
    commerce: true,
    nativeAnswer:
      "Build a card from the dashboard: \"+ Add card\" opens a four-step builder — Card information, Card design, Socials, then Social design.",
  },
  {
    id: "trial-and-refunds",
    title: "Free trial, cancelling, refunds",
    audience: ["visitor", "user"],
    triggers: [
      "free trial", "trial", "cancel", "refund", "lock in", "commitment", "contract",
      "money back", "cancel anytime", "auto renew",
    ],
    answer:
      "Subscribing to Pro starts with a {trial.days}-day free trial: a card is collected at checkout, and billing starts automatically when the trial ends unless you cancel first. No contracts — cancel anytime and you keep access to the end of the period you've paid for. Payments run through Stripe.",
    detail:
      "Two limits worth stating plainly rather than letting someone discover them: the trial is Pro ONLY (the Office plan has no trial), and it is for new customers only — someone who has subscribed before is charged immediately on the next subscription. The Free plan is free forever and needs no card at all. There's a \"Have a promo code?\" field on the pricing page; a code is checked before checkout, so an invalid one is rejected there rather than silently ignored.",
    commerce: true,
    nativeAnswer:
      "The Free plan is free forever. Paid plans can be stopped at any time, and access continues to the end of the period already covered.",
  },
  {
    id: "reviews-and-trust",
    title: "Reviews, ratings, and whether it's legit",
    audience: ["visitor"],
    triggers: [
      "review", "reviews", "testimonial", "testimonials", "rating", "legit", "trust", "scam",
      "who uses", "how many users", "customers", "case study",
    ],
    answer:
      "Honest answer: SwiftCard is new and we don't publish reviews, ratings, or user counts we don't have. swiftcard.me/testimonials shows what it does for different professions — real estate, sales, recruiting, creators, consultants — not customer quotes. The best way to judge it is the free plan, which takes about a minute to set up at swiftcard.me/cards/new.",
    detail:
      "This restraint is deliberate and legally required (FTC 16 CFR Part 465 on fake reviews). Never invent a statistic, a customer count, a rating, an award, a testimonial, or a named customer, and never imply one exists. If pushed, repeat that there aren't published numbers yet and point at the free plan or swiftcard.me/contact.",
  },
  {
    id: "ios-app-availability",
    title: "Is there an iOS/Android app?",
    audience: ["visitor", "user"],
    triggers: [
      "ios app", "iphone app", "android app", "app store", "google play", "download the app",
      "is there an app", "mobile app", "play store",
    ],
    answer:
      "There is an iPhone app for managing your own cards, but it isn't downloadable from the App Store yet — it's in review. Everything works in the browser on any phone in the meantime, and there's no Android app. Nobody needs an app to receive your card either way.",
    detail:
      "Do not tell anyone to find SwiftCard in the App Store or to look for a download link on the site — the site deliberately renders no App Store badge while the listing isn't live (the homepage hero and footer each have one that appears on its own the moment it is), so they would be hunting for something that isn't there. If someone asks when: say it's with Apple for review and there's no date to promise.",
  },
  {
    id: "privacy-and-data",
    title: "Privacy, security, and your data",
    audience: ["visitor", "user"],
    triggers: [
      "privacy", "data", "secure", "security", "gdpr", "sell my data", "encrypted",
      "who can see", "delete my data", "ccpa",
    ],
    answer:
      "Your card shows only what you choose to make public, data is encrypted in transit and at rest, and SwiftCard does not sell your data or your contacts' data. The full policy is at swiftcard.me/privacy, and deleting your account is covered there too.",
    detail:
      "Card pages are public by design — anyone with the link can see what you put on the card. Contacts, analytics and account details are private to you (and, on an Office plan, to your office admins). Deleting an account keeps a one-month window in which logging back in reopens it; after that it is permanent.",
  },
  {
    id: "sms-consent-public",
    title: "Text messages and consent",
    audience: ["visitor", "user"],
    triggers: [
      "sms", "text messages", "texting", "opt in", "opt out", "stop texts", "consent",
      "tcpa", "unsubscribe from texts", "a2p",
    ],
    answer:
      "Texts only go to people who tick the optional consent box themselves on the \"Share your info\" form — it is never pre-ticked and never required. Replying STOP to any message opts that number out; START opts back in. The details are at swiftcard.me/sms-consent and swiftcard.me/sms-terms.",
    detail:
      "Never describe the consent checkbox as required, and never suggest a way to work around it — the wording on that checkbox is carrier-approved compliance copy and the campaign registration depends on it matching the published pages. All SwiftCard texts come from one shared number, so a STOP from a recipient stops SwiftCard texts to that number from every sender on the platform, not just the one they were talking to.",
  },
  {
    id: "contact-support",
    title: "Reaching a human",
    audience: ["visitor", "user", "office-admin"],
    triggers: [
      "contact", "contact support", "email you", "talk to someone", "talk to a human",
      "support", "contact you", "get help from a person", "phone number", "call you",
    ],
    answer:
      "Use the contact form at swiftcard.me/contact — pick what it's about, and a real person replies by email, usually within one business day. There's no support phone line.",
    detail:
      "The form asks for your name, email, a topic (General question, Help with my account, Teams & Offices, and so on) and your message. It replies to the email address entered, so a typo there means a lost reply. The team is in New York and answers on weekdays, US Eastern.",
  },
  {
    id: "teams-and-offices-visitor",
    title: "Teams and offices",
    audience: ["visitor"],
    triggers: [
      "team", "teams", "office", "company", "employees", "org", "business account",
      "multiple people", "my staff", "enterprise",
    ],
    answer:
      "The Office plan puts a whole team on matching, brand-synced cards: an admin sets the company logo, contact details and design once and it applies to everyone's card, invites new people with a passwordless link, and sees per-person analytics and every teammate's leads in one place. It's priced per seat with a minimum of {limit.seats} seats — see swiftcard.me/pricing.",
    detail:
      "Each seat includes everything in Pro. Leads stay with the office when someone leaves, and removing a person frees their seat and strips the company branding from the card they keep. There's a Teams page at swiftcard.me/products/teams, and swiftcard.me/office is the sign-up path.",
    commerce: true,
    nativeAnswer:
      "The Office plan puts a whole team on matching, brand-synced cards: an admin sets the company logo, contact details and design once and it applies to everyone's card, invites people with a passwordless link, and sees per-person analytics plus every teammate's leads in one place. It needs at least {limit.seats} seats, and each seat includes everything in Pro.",
  },
]);
