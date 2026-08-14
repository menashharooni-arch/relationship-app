import { defineDocs } from "../types";

// The dashboard, its numbers, and its notifications.

export const dashboardDocs = defineDocs([
  {
    id: "dashboard-overview",
    title: "The dashboard",
    audience: ["user"],
    triggers: [
      "dashboard", "home screen", "main screen", "select a card", "pick a card",
      "dashboard is empty", "nothing on my dashboard", "blank dashboard",
    ],
    answer:
      "The dashboard at /dashboard is scoped to one card at a time. If you have more than one card you'll first see a \"Select a card\" screen — pick one and the rest of the page fills in. Top to bottom: \"My Cards\", the \"Traffic\" box, and \"Quick Contacts\" (which toggles between Notifications and Contacts).",
    detail:
      "A blank-looking dashboard on a multi-card account is almost always the \"Select a card\" screen rather than a fault. With exactly one card it opens straight into it. \"My Cards\" has \"View live\" and \"Add card\" buttons — but no Edit link; editing lives only in Settings → Cards and sharing. On a phone only the selected card shows, with a chevron to reveal the others. There's also a \"Your Card\" panel showing a live render of the card (\"Exactly what people get when you share.\") with the Share controls beneath it, and a sun/moon button in the top bar switching between light and dark.",
  },
  {
    id: "analytics",
    title: "Views and analytics",
    audience: ["user"],
    triggers: [
      "analytics", "views", "card views", "link views", "stats", "who viewed",
      "how many views", "traffic", "unique visitors", "best day", "insights",
    ],
    answer:
      "The \"Traffic\" box on the dashboard. Two tiles — \"SwiftCard views\" and \"Swift Link views\" — plus a bar chart, a \"Unique viewers / Repeat views\" line, and a footer with your contact count and your best day. The Today / Week / Month control above them sets the window; the \"Locations\" tab is Pro.",
    detail:
      "Details that come up: the tiles count VIEWS, not people — \"Unique viewers\" is the people number, and someone on two devices counts twice. \"Best day\" always looks at the last 30 days and ignores the Today/Week/Month choice, so it can name a date outside the window you're looking at. \"Today\" starts at your own local midnight. Top locations are all-time and city-level at best; visitor IPs are never stored. There is no percentage-change indicator and no conversion-rate figure on the personal dashboard, and no all-cards combined view — analytics are per card.",
  },
  {
    id: "what-counts-as-a-view",
    title: "What counts as a view",
    audience: ["user"],
    triggers: [
      "counts as a view", "why did my views", "views wrong", "view count", "refresh count",
      "do my own views count", "repeat view", "visit window",
    ],
    answer:
      "One visit is one view. The same person touching the same page again within 30 minutes doesn't add another — reloads and back-navigation are the same visit. After 30 minutes, the same person coming back genuinely is a repeat view and counts again. Your own views of your own card never count.",
    detail:
      "Older answers that said \"one view per person per day\" are wrong — the window is 30 minutes, not 24 hours. Bot traffic is filtered out, and seeded demo views are excluded from milestone counts.",
  },
  {
    id: "notifications",
    title: "Notifications",
    audience: ["user"],
    triggers: [
      "notification", "notifications", "alerts", "bell", "dismiss", "clear read",
      "mark read", "mark as read", "unread", "badge", "blue dot",
    ],
    answer:
      "Two places. The bell in the top bar shows every card's notifications, with a red unread badge (capped at \"9+\") and \"Mark all read\" / \"Clear read\". The dashboard's \"Quick Contacts\" section has a \"Notifications\" toggle showing the selected card's activity. Each row has a Read/Unread toggle and an ✕ to dismiss.",
    detail:
      "Opening the bell does not mark anything read — the badge only drops when you tap Read, Mark all read, or dismiss. The bell polls for new items; the dashboard panel is rendered with the page and only updates on reload. Both show the 20 most recent. \"Clear read\" removes read ones permanently. You'll get notifications for new contacts, card views and saves, and view milestones (5, 10, 25, 50, 100 and up, counted per card). \"Someone viewed your card\" simply means that viewer has never shared their details through SwiftCard — it isn't a fault or a privacy setting.",
  },
  {
    id: "guided-tour",
    title: "The guided tour",
    audience: ["user"],
    triggers: ["tour", "walkthrough", "guided tour", "show me around", "replay tour", "take a tour"],
    answer:
      "New accounts get a \"Take a quick tour\" banner on the dashboard. To replay it later, go to Settings → Help and referrals → \"Take a Tour\". It spotlights each part of the app across the dashboard, Links, Contacts and Settings, with Back / Next and a Skip option.",
    detail:
      "Whether the tour has been taken is remembered per browser, so it can reappear on a new device and won't come back on the same one after a Skip. If a step seems to hang for a couple of seconds it's waiting for an element it can't find, and it will skip that step by itself. The Office admin console has its own separate \"Tour\" button.",
  },
  {
    id: "help-us-grow",
    title: "The \"Help us grow\" page",
    audience: ["user"],
    triggers: ["help us grow", "grow", "heart icon", "rate us", "spread the word", "share swiftcard"],
    answer:
      "The heart icon in the top bar opens /grow — \"Help us grow\". It has Rate us, Invite friends & earn (your referral box), Spread the word, and a few other ways to help, like adding your Swift Signature to your email.",
    detail:
      "People describe this as \"the heart\" because the icon has no text label. The referral box is here and in Settings → Help and referrals — it is NOT on the dashboard, which is a common wrong answer. Office sub-users don't have this page.",
  },
]);
