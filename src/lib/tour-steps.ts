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
    body:
      "Take a minute and I'll show you around your dashboard and where everything lives. Use Next and Back to move through it, or Skip anytime — you can replay this later from Settings.",
  },

  // ── Top navigation ────────────────────────────────────────────────────────
  {
    id: "nav-dashboard",
    path: DASH,
    anchor: "nav-dashboard",
    title: "Dashboard — your home base",
    body:
      "Your traffic, contacts, and card all live here. It's the first thing you'll open each day to see who's new. You're on it right now.",
    placement: "bottom",
  },
  {
    id: "nav-contacts",
    path: DASH,
    anchor: "nav-contacts",
    title: "Contacts",
    body:
      "The full book of everyone who's shared their info with you — searchable, with each person's history. We'll open it together in a moment.",
    placement: "bottom",
  },
  {
    id: "nav-settings",
    path: DASH,
    anchor: "nav-settings",
    title: "Settings",
    body:
      "Manage your cards, connect other tools, refer friends, and handle your account. Head here whenever you want to change how SwiftCard works. The tour finishes here.",
    placement: "bottom",
  },
  {
    id: "notif-bell",
    path: DASH,
    anchor: "notif-bell",
    title: "Notifications",
    body:
      "A live feed of new contacts and milestones. When the dot appears, someone just saved your card or hit a goal — tap to see what happened.",
    placement: "bottom",
  },
  {
    id: "theme",
    path: DASH,
    anchor: "theme",
    title: "Light or dark",
    body: "Prefer a lighter screen? Tap to switch the whole app's look. It sticks next time you sign in.",
    placement: "bottom",
  },

  // ── Cards + sharing ───────────────────────────────────────────────────────
  {
    id: "my-cards",
    path: DASH,
    anchor: "my-cards",
    title: "My Cards",
    body:
      "Every card you own lives here. Tap one to select it and the whole dashboard updates to that card. Free includes one card; Pro unlocks unlimited — handy if you want a separate card for a side business.",
    placement: "bottom",
  },
  {
    id: "your-card",
    path: DASH,
    anchor: "your-card",
    title: "Your SwiftCard — give it a tap",
    body:
      "This is exactly what people see when you share. Go ahead and tap it to preview the real thing. Keep it current by tapping Edit on the card above.",
    placement: "right",
    clickToAdvance: true,
  },
  {
    id: "share",
    path: DASH,
    anchor: "share",
    title: "Share your card",
    body:
      "Send it by link, QR code, text, or email. This is the moment a new lead is captured — every share can land straight in your contacts with follow-ups ready to go.",
    placement: "right",
  },

  // ── Insight tiles ─────────────────────────────────────────────────────────
  {
    id: "traffic",
    path: DASH,
    anchor: "traffic",
    title: "Traffic",
    body:
      "How many times your card and your Swift Links page were viewed. Switch between Today, Week, and Month to see if a campaign is landing — or tap Locations to see the top places your views come from.",
    placement: "bottom",
  },
  {
    id: "swift-links",
    path: DASH,
    anchor: "swift-links",
    title: "Swift Links",
    body:
      "A separate link-in-bio page — your bio, all your socials, and your links in one place. Drop it in your Instagram, TikTok, or other social bios so followers can reach everything at once.",
    placement: "bottom",
  },
  {
    id: "email-signature",
    path: DASH,
    anchor: "email-signature",
    title: "Swift Signature",
    body:
      "Puts your live card at the bottom of every email you send. Preview it here, copy it once, and paste it into Gmail or Outlook — every email then shares your card for you.",
    placement: "left",
  },

  // ── Contacts on the dashboard ─────────────────────────────────────────────
  {
    id: "contact-views",
    path: DASH,
    anchor: "contact-views",
    title: "Three ways to see your leads",
    body:
      "Flip between Notifications (newest activity), a sortable List, and a drag-and-drop Pipeline. Use the Pipeline to move people from New Contact to Touch as you work them.",
    placement: "top",
  },
  {
    id: "contact-filters",
    path: DASH,
    anchor: "contact-filters",
    title: "Filter your leads",
    body:
      "Narrow the list by status — New Contact, Touch, or Dissolved — or by how recently they came in. Perfect for a quick 'who did I meet this week?' check.",
    placement: "top",
  },
  {
    id: "add-contact",
    path: DASH,
    anchor: "add-contact",
    title: "Add a contact by hand",
    body:
      "Met someone offline or got a card the old-fashioned way? Add them here. Everyone who scans or taps your card shows up automatically — this is just for the ones who don't.",
    placement: "left",
  },

  // ── Contacts page ─────────────────────────────────────────────────────────
  {
    id: "contacts-page",
    path: CONTACTS,
    anchor: "contacts-page",
    title: "Your full contact book",
    body:
      "Here's the complete Contacts page. Open anyone to see their full history, add notes, set a follow-up date, and (on Pro) export everyone to a CSV. This is your CRM.",
    placement: "bottom",
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  {
    id: "settings-cards",
    path: SETTINGS,
    anchor: "settings-cards",
    title: "Your cards",
    body:
      "Rename, edit, or add cards from here, and choose which one is your main card. This is the quickest place to tidy up your cards.",
    placement: "bottom",
  },
  {
    id: "settings-help",
    path: SETTINGS,
    anchor: "settings-help",
    title: "Help — and this tour",
    body:
      "Stuck on anything? Ask the built-in assistant a question in plain English. And whenever you want a refresher, the Take a Tour button right here replays this whole walkthrough.",
    placement: "bottom",
  },
  {
    id: "settings-refer",
    path: SETTINGS,
    anchor: "settings-refer",
    title: "Refer a friend",
    body:
      "Share your personal link. When three friends sign up, you earn a free month of Pro — up to three months. Your friends get a free month too.",
    placement: "bottom",
  },
  {
    id: "settings-integrations",
    path: SETTINGS,
    anchor: "settings-integrations",
    title: "Integrations",
    body:
      "Connect Zapier or Google Contacts so new contacts flow straight into the tools you already use. Set this up once and your leads sync themselves.",
    placement: "bottom",
  },
  {
    id: "settings-general",
    path: SETTINGS,
    anchor: "settings-general",
    title: "General",
    body:
      "Your plan, your email, and app preferences all live here. Check in when you want to upgrade or update your details.",
    placement: "bottom",
  },

  // ── Finish ────────────────────────────────────────────────────────────────
  {
    id: "finish",
    path: SETTINGS,
    title: "You're all set 🎉",
    body:
      "That's the whole app. Replay this anytime from Settings → Help → Take a Tour. Now go share your card and watch your first contacts roll in.",
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
