// ── Guided tour: the walkthrough itself ─────────────────────────────────────
// One ordered list of steps that spans three pages. Each step points at an
// element via its data-tour attribute (stable across restyles). The engine
// spotlights the element, shows the copy, and — when a step lives on a different
// page than the one you're on — navigates there and resumes.
//
// Copy rule: every step says WHAT the thing is and WHEN you'd reach for it.
// Deliberately NO step for "delete account" — the tour never highlights it.

export type TourStep = {
  id: string;
  /** Route this step lives on. The engine navigates here if you're elsewhere. */
  path: string;
  /** data-tour value of the element to spotlight. Omit for a centered message. */
  anchor?: string;
  title: string;
  body: string;
  /** Preferred tooltip side; the engine flips it if there isn't room. */
  placement?: "top" | "bottom" | "left" | "right";
  /** Let the visitor click the highlighted element to advance (Next still works). */
  clickToAdvance?: boolean;
};

const DASH = "/dashboard";
const CONTACTS = "/contacts";
const SETTINGS = "/settings/flows";

export const TOUR_STEPS: TourStep[] = [
  // ── Welcome ───────────────────────────────────────────────────────────────
  {
    id: "welcome",
    path: DASH,
    title: "Welcome to SwiftCard 👋",
    body: "A quick lap around your dashboard. Use Next and Back, or Skip anytime — you can replay this from Settings.",
  },

  // ── Top navigation ────────────────────────────────────────────────────────
  {
    id: "nav-dashboard",
    path: DASH,
    anchor: "nav-dashboard",
    title: "Dashboard",
    body: "Your home base — traffic, contacts, and card, all in one place. You're on it now.",
    placement: "bottom",
  },
  {
    id: "nav-contacts",
    path: DASH,
    anchor: "nav-contacts",
    title: "Contacts",
    body: "Everyone who's shared their info — searchable, with full history. We'll open it shortly.",
    placement: "bottom",
  },
  {
    id: "nav-settings",
    path: DASH,
    anchor: "nav-settings",
    title: "Settings",
    body: "Cards, integrations, referrals, and your account. The tour ends here.",
    placement: "bottom",
  },
  {
    id: "notif-bell",
    path: DASH,
    anchor: "notif-bell",
    title: "Notifications",
    body: "New contacts and milestones land here. A dot means something just happened — tap to see.",
    placement: "bottom",
  },
  {
    id: "theme",
    path: DASH,
    anchor: "theme",
    title: "Light or dark",
    body: "Tap to switch the app's look. It sticks.",
    placement: "bottom",
  },

  // ── Cards + sharing ───────────────────────────────────────────────────────
  {
    id: "my-cards",
    path: DASH,
    anchor: "my-cards",
    title: "My Cards",
    body: "All your cards. Tap one to switch — the dashboard follows it. Free has one; Pro is unlimited.",
    placement: "bottom",
  },
  {
    id: "your-card",
    path: DASH,
    anchor: "your-card",
    title: "Your SwiftCard — tap it",
    body: "Exactly what people see when you share. Tap to preview it; hit Edit above to change it.",
    placement: "right",
    clickToAdvance: true,
  },
  {
    id: "share",
    path: DASH,
    anchor: "share",
    title: "Share your card",
    body: "Send it by link, QR, text, or email. Every share can land a new lead in your contacts.",
    placement: "right",
  },

  // ── Insight tiles ─────────────────────────────────────────────────────────
  {
    id: "traffic",
    path: DASH,
    anchor: "traffic",
    title: "Traffic",
    body: "Views of your card and Swift Links. Switch Today / Week / Month, or tap Locations for top places.",
    placement: "bottom",
  },
  {
    id: "swift-links",
    path: DASH,
    anchor: "swift-links",
    title: "Swift Links",
    body: "Your link-in-bio — bio, socials, and links in one page. Drop it in your Instagram or TikTok bio.",
    placement: "bottom",
  },
  {
    id: "email-signature",
    path: DASH,
    anchor: "email-signature",
    title: "Swift Signature",
    body: "Puts your live card in every email. Copy it once, paste into Gmail or Outlook.",
    placement: "left",
  },

  // ── Contacts on the dashboard ─────────────────────────────────────────────
  {
    id: "contact-views",
    path: DASH,
    anchor: "contact-views",
    title: "Three ways to see leads",
    body: "Notifications (newest first), a sortable List, or a drag-and-drop Pipeline.",
    placement: "top",
  },
  {
    id: "contact-filters",
    path: DASH,
    anchor: "contact-filters",
    title: "Filter leads",
    body: "Narrow by status or how recently they came in — great for 'who did I meet this week?'",
    placement: "top",
  },
  {
    id: "add-contact",
    path: DASH,
    anchor: "add-contact",
    title: "Add a contact",
    body: "Met someone offline? Add them here — or scan their business card and it auto-fills. Card taps show up on their own.",
    placement: "left",
  },

  // ── Contacts page — walk through a real contact + its automations ─────────
  // (The Contacts page auto-opens the sample contact while the tour runs, so
  // these two steps always have a live contact to point at.)
  {
    id: "contact-detail",
    path: CONTACTS,
    anchor: "contact-detail",
    title: "This is a contact",
    body: "Here's a sample contact we added so you can see it (delete anytime). Open anyone to see how you met, your notes, their status, and the full conversation.",
    placement: "bottom",
  },
  {
    id: "contact-automations",
    path: CONTACTS,
    anchor: "contact-automations",
    title: "Follow up on autopilot",
    body: "The magic: flip on Email or Text, pick a cadence (Light, Medium, Aggressive), and AI writes each message from your notes. Hit Submit and SwiftCard sends the whole sequence for you — leads never go cold. Email and text run separately.",
    placement: "top",
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  {
    id: "settings-cards",
    path: SETTINGS,
    anchor: "settings-cards",
    title: "Your cards",
    body: "Rename, edit, add cards, or set your main one.",
    placement: "bottom",
  },
  {
    id: "settings-help",
    path: SETTINGS,
    anchor: "settings-help",
    title: "Help & this tour",
    body: "Ask the built-in assistant anything — and replay this tour from here anytime.",
    placement: "bottom",
  },
  {
    id: "settings-refer",
    path: SETTINGS,
    anchor: "settings-refer",
    title: "Refer a friend",
    body: "Share your link: 3 sign-ups = a free month of Pro (up to 3). Your friends get a free month too.",
    placement: "bottom",
  },
  {
    id: "settings-integrations",
    path: SETTINGS,
    anchor: "settings-integrations",
    title: "Integrations",
    body: "Connect Zapier or Google Contacts so new leads sync to your tools automatically.",
    placement: "bottom",
  },
  {
    id: "settings-general",
    path: SETTINGS,
    anchor: "settings-general",
    title: "General",
    body: "Your plan, email, and preferences — upgrade or update details here.",
    placement: "bottom",
  },

  // ── Finish ────────────────────────────────────────────────────────────────
  {
    id: "finish",
    path: SETTINGS,
    title: "You're all set 🎉",
    body: "That's the whole app. Now go share your card and watch your contacts roll in.",
  },
];

// Dashboard/Contacts steps should stay on the card the tour started with, so the
// dashboard doesn't bounce to the card picker mid-tour.
export function resolveTourPath(step: TourStep, card: string | null): string {
  if ((step.path === "/dashboard" || step.path === "/contacts") && card) {
    return `${step.path}?card=${encodeURIComponent(card)}`;
  }
  return step.path;
}
