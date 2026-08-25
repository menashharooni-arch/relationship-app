import { defineDocs } from "../types";

// What SwiftCard IS, and what a card does once it exists. Shared by the
// marketing chat and the in-app helper — a visitor deciding and a customer
// using it need the same underlying facts, only framed differently.

export const productDocs = defineDocs([
  {
    id: "greeting",
    title: "Saying hello",
    audience: ["visitor", "user", "office-admin"],
    triggers: ["hello", "hi", "hey", "help me", "what can you help with", "are you there", "good morning"],
    answer:
      "Hi! I can help you find your way around SwiftCard and explain how things work. Try asking \"How do I create a card?\", \"How do I share my card?\", \"Where are my contacts?\", or \"What's included in Pro?\"",
    detail:
      "Answer a bare greeting warmly and offer two or three concrete example questions rather than a list of every feature.",
    commerce: true,
    nativeAnswer:
      "Hi! I can help you find your way around SwiftCard and explain how things work. Try asking \"How do I create a card?\", \"How do I share my card?\", or \"Where are my contacts?\"",
  },
  {
    id: "what-is-swiftcard",
    title: "What SwiftCard is",
    audience: ["visitor", "user"],
    triggers: [
      "what is swiftcard", "what is this", "what does swiftcard do", "how does it work",
      "what do you sell", "explain swiftcard", "what can you do",
    ],
    answer:
      "SwiftCard is a digital business card. You build a card once and share it by link, QR code, Apple Wallet pass, or an NFC card — the other person needs no app, because it opens in their browser and saves to their contacts in one tap. Everyone who shares their details back lands in your contacts, with follow-up that can run automatically. Build one free in about a minute at swiftcard.me/cards/new.",
    detail:
      "One account can hold several cards. Every card gets two public pages: the card page at swiftcard.me/<your-url>, and a Swift Links page at swiftcard.me/links/<your-url> — a link-in-bio with your photo, bio, social icons, video previews and custom buttons. The same card also powers Swift Signature (your live card in your email footer) and the Apple Wallet pass. Nothing about receiving a card requires the recipient to install anything.",
  },
  {
    id: "no-app-needed",
    title: "The other person needs no app",
    audience: ["visitor", "user"],
    triggers: [
      "need an app", "download", "do they need", "receive my card", "no app",
      "without an app", "app required", "does the other person need",
    ],
    answer:
      "No app is needed on either side. Your card is a link — share it by QR, text, Apple Wallet, or an NFC card, and it opens in the other person's browser. They save your contact to their phone in one tap.",
    detail:
      "On the public card page a visitor gets: a one-tap save-to-contacts (a .vcf download), a \"Share your info\" form that sends their name, email and phone straight into your contacts, an optional \"What people say\" block of testimonials you've added, your Swift Links block, and a share sheet for passing your card on. There is a SwiftCard iOS app, but it is for card OWNERS to manage their own cards — nobody needs it to receive a card.",
  },
  {
    id: "swift-links",
    title: "Swift Links — the link-in-bio page",
    audience: ["visitor", "user"],
    triggers: [
      "swift link", "swift links", "swiftlink", "swiftlinks", "links page", "bio page",
      "linktree", "link tree", "bio link", "instagram bio", "link in bio",
    ],
    answer:
      "Every card comes with a Swift Links page at swiftcard.me/links/<your-url> — your photo, bio, social icons, video previews and custom link buttons on one page. It is what you put in an Instagram or TikTok bio.",
    detail:
      "You set the bio, socials and extra buttons on the Socials step of the card builder (step 3), or the \"Socials\" tab when editing a card. How the page LOOKS is the separate \"Social design\" step/tab: pick a named Look — one tap sets the whole scheme. Every page defaults to the light \"Paper\" Look; Free can also choose the dark \"Onyx\", while the full Look library and the custom background/text/font pickers are Pro. The Pro library is Blush, Sand, Chrome, Forest, Midnight, Orchid, two gradients (Dawn, Nebula), and \"Aura\" — which uses the owner's own headshot, blurred and dimmed, as the page background (with a plain dark page as the fallback if the card has no photo). The \"Social icons\" control on the same step restyles the social chips at the top of the page — shape (Circle, Squircle or Square) and color (each network's own Brand color, all in the Look's Accent color, or quiet Mono) — and is also Pro. Free allows {limit.links} additional link buttons, shown as slim rows; paid plans are unlimited and each link gets a tile-size control (Auto, Featured full-width, Grid half-width pairs, or Compact rows) next to it in the editor, plus an \"+ Add a section header\" option to break a long page into titled sections. Video previews, featured tiles, the grid and section headers are Pro.",
  },
  {
    id: "who-its-for",
    title: "Who SwiftCard is built for",
    audience: ["visitor"],
    triggers: [
      "who is this for", "is this for realtors", "real estate", "realtor", "contractor",
      "insurance agent", "loan officer", "lawyer", "photographer", "barber", "stylist",
      "car sales", "my industry", "for my business",
    ],
    answer:
      "SwiftCard works for anyone who meets people and wants to be remembered — and it's especially loved by real estate agents (open-house QR sign-ins), contractors, insurance agents, loan officers, lawyers, photographers, barbers and stylists, and car salespeople. There's a dedicated page for each at swiftcard.me/for/<industry>, e.g. swiftcard.me/for/real-estate-agents.",
    detail:
      "The /for/[slug] pages (real-estate-agents, contractors, insurance-agents, loan-officers, lawyers, photographers, barbers-and-stylists, car-salespeople) walk through how that profession uses SwiftCard: where they share the card, what lead capture replaces (sign-in sheets, fishbowls, DMs), and industry-specific FAQ. When a visitor names their industry, point them at the matching page; when their industry isn't listed, the honest answer is that SwiftCard is industry-agnostic — cards, QR/NFC sharing, lead capture and follow-up work the same everywhere. For visitors comparing tools, swiftcard.me/compare has the full side-by-side table, and /compare/[slug] pages (linktree-alternative, popl-alternative, blinq-alternative, hihello-alternative) each compare SwiftCard against one competitor — the short version: SwiftCard bundles the card, link-in-bio page, lead CRM, and automated email + text follow-up into one plan, which the others don't do out of the box.",
  },
  {
    id: "sharing-a-card",
    title: "Every way to share a card",
    audience: ["visitor", "user"],
    triggers: [
      "share", "share my card", "how do i share", "send my card", "other ways to share",
      "share link", "how do people get my card", "qr", "qr code", "scan",
    ],
    answer:
      "On the dashboard, the \"Share\" button opens your phone's share sheet with your card link, and \"Other ways to share\" next to it opens everything else: copy the link, download the card or QR as a PNG, add it to Apple Wallet, or write an NFC tag. On a phone the \"Your Card\" panel also has \"Scan to connect (QR)\" to hold up on the spot.",
    detail:
      "The \"Links\" tab (/share) is where the Swift Links URL and the Swift Signature generator live. Everything shares the same card page, so a printed QR or a written NFC card keeps working after you edit the card — they store the link, not the details. Each sharing surface tags itself, so the dashboard can tell you a visit came from a QR scan, an NFC tap, Apple Wallet, or a plain link.",
  },
  {
    id: "apple-wallet",
    title: "Apple Wallet pass",
    audience: ["visitor", "user"],
    triggers: [
      "apple wallet", "wallet", "wallet pass", "add to wallet", "apple watch", "watch",
      "google wallet", "android wallet",
    ],
    answer:
      "Your own card can go in Apple Wallet: dashboard → \"Other ways to share\" → \"Add to Apple Wallet\". The pass carries your card's look and a big QR, so it's a couple of taps away and shows on Apple Watch.",
    detail:
      "The pass keeps itself current: once it's in Wallet it registers with SwiftCard, so editing your card updates the pass already on the phone — no need to re-add it. Two things people expect that aren't there. There is no \"Add to Apple Wallet\" button on the public card page — a visitor cannot add SOMEONE ELSE's card to their Wallet, only save them as a contact. And there is no watchOS app: the Watch simply shows the Wallet pass. There is no Google Wallet pass either; on Android, share the link or the QR. The \"Add SwiftCard to Wallet\" button on the marketing homepage is a call to action that opens the card builder — a pass only exists once you've built a card and signed in.",
  },
  {
    id: "nfc",
    title: "NFC cards and tags",
    audience: ["visitor", "user"],
    triggers: ["nfc", "tap to share", "nfc card", "nfc tag", "tap my phone", "write nfc"],
    answer:
      "Buy any blank NFC tag or card, then write your card link to it once — after that a tap opens your card on the other person's phone, with nothing for them to install. The writer is on the dashboard under \"Other ways to share\" → \"Write to a tag\".",
    detail:
      "Writing a tag from the browser only works on Android Chrome. On an iPhone or a computer the button says so and points you at a free app like NFC Tools, where you write the same link by hand. IMPORTANT and often misunderstood: NFC goes from a CARD or TAG to a phone — it does not work phone-to-phone. An iPhone cannot present itself as a readable tag to another phone, so \"tap my phone against yours\" is not something SwiftCard or anyone else can do. Say \"NFC card\" or \"NFC tag\", and offer the QR code or the link for the phone-to-phone case.",
  },
  {
    id: "swift-signature",
    title: "Swift Signature — your card in your email",
    audience: ["visitor", "user"],
    triggers: [
      "signature", "email signature", "swift signature", "gmail signature", "outlook signature",
      "signature generator",
    ],
    answer:
      "Swift Signature turns your card into an email signature for Gmail, Outlook, Apple Mail and the rest. Open the \"Links\" tab (/share), find \"SWIFT SIGNATURE\", and use \"Preview & copy\" — then paste it into your mail app's signature settings. It's on every plan.",
    detail:
      "The signature is a picture of your card that links back to your card page, so anyone replying to an ordinary email can still save you or share their details back. Because it's a snapshot rather than a live render, changing your card design takes about a day to show up in signatures already pasted into inboxes — mail apps cache the image. The Links page prompts you to re-copy only when the card itself changed (card info or card design) — Swift Links page edits don't affect the card image, so they never trigger it. Automated follow-up emails sign off with the same card image automatically, and texts end with your card link, which unfurls into a card preview in messaging apps.",
  },
  {
    id: "lead-capture",
    title: "How a share becomes a contact",
    audience: ["visitor", "user"],
    triggers: [
      "lead capture", "capture leads", "how do i get leads", "share your info",
      "share my info", "who saved my card", "collect contact",
    ],
    answer:
      "Anyone looking at your card can use \"Share your info\" to send you their name, email and phone. That lands in your Contacts straight away, tagged with which card it came from and how they reached you — and it can trigger an automatic follow-up.",
    detail:
      "The form is on every public card page. Text follow-ups need the visitor to tick the optional SMS consent box themselves; it is never pre-ticked and never required to submit. Saving your contact (the .vcf) is a separate action and does not by itself tell you who saved you — the \"Share your info\" form is what creates a contact.",
  },
  {
    id: "made-with-swiftcard-badge",
    title: "The \"Made with SwiftCard\" badge",
    audience: ["visitor", "user"],
    triggers: ["badge", "made with swiftcard", "branding", "remove branding", "white label", "your logo on my card"],
    answer:
      "There's a small \"Made with SwiftCard — Get yours free\" badge, and it shows on every plan: on a card page it appears once a visitor taps Save Contact, and every Swift Links page ends with a \"Made with swiftcard.me\" footer link. Every card page also has a \"Get a free card like this\" button under \"Share this card\", on all plans. What a paid plan removes is SwiftCard's branding on the automated emails and texts you send.",
    detail:
      "Be precise here, because it's easy to overstate and it's a paid promise. Paying removes one thing: SwiftCard branding in automated follow-up emails and texts. It does NOT remove the \"Made with SwiftCard\" badge or the \"Get a free card like this\" button under Share this card — those are universal, on Free, Pro and Office alike (the button replaced the old faint \"Create your card\" line, which WAS Free-only; owner decision 2026-08-25). If someone asks whether upgrading takes the badge off their card page, the honest answer is no. Some marketing copy still says \"no SwiftCard branding anywhere\", which overstates it. The unsubscribe link in follow-up emails is never removed on any plan either; that's a legal requirement, not branding.",
  },
  {
    id: "multiple-cards",
    title: "Having more than one card",
    audience: ["visitor", "user"],
    triggers: [
      "multiple cards", "more than one card", "second card", "switch card", "select a card",
      "select card", "my cards", "active card", "another card",
    ],
    answer:
      "You can hold several cards on one account — one per business, role, or language, each with its own URL, design, contacts and analytics. The \"My Cards\" section of the dashboard switches which card you're working on. Free is limited to {limit.cards} card; paid plans are unlimited.",
    detail:
      "Each card is genuinely separate: its own headshot, its own template, its own contacts. A card with no headshot will not borrow one from another card. If an account drops below a paid plan, extra cards stop loading for visitors — the QR codes and NFC cards pointing at them stop working until the account is paid again. The cards and their data are not deleted.",
  },
]);
