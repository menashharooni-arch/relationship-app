// ── Guided tour: the walkthrough itself ─────────────────────────────────────
// One ordered list of steps that spans four pages. Each step points at an
// element via its data-tour attribute (stable across restyles). The engine
// spotlights the element, shows the copy, and — when a step lives on a different
// page than the one you're on — navigates there and resumes.
//
// Copy rule: every step says WHAT the thing is and WHEN you'd reach for it.
// Deliberately NO step for "delete account" — the tour never highlights it.
//
// PLAN-AWARE: the same base list is filtered + reworded per account so the tour
// only ever describes what THIS account actually has. `buildTourSteps(ctx)` is
// the source the running tour uses; `TOUR_STEPS` is the full base list (every
// step, base copy) kept for tests and as a safe fallback when no context is
// known yet. The four shapes:
//   • free           — one card, no automations/locations, upgrade prompts
//   • pro            — unlimited cards, automations, locations, referrals
//   • office owner    — team console (Admin), seats, company branding
//   • office member   — company-managed card; no billing, seats, or referrals

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
  /**
   * Keep the spotlighted element fully clickable WITHOUT advancing the tour, so
   * the visitor can genuinely interact with it (e.g. open a live preview) and
   * then continue with Next. Unlike clickToAdvance, a click here does nothing to
   * the tour — the real control runs.
   */
  interactive?: boolean;
  /**
   * Settings only. SettingsShell shows ONE section at a time (a desktop panel /
   * a mobile accordion), so a step whose anchor lives inside a collapsed section
   * would never be found. Naming the section here makes the engine open it (via
   * the #hash SettingsShell already listens to) before spotlighting the anchor.
   */
  section?: string;
};

// Which plan the running tour describes. Office covers both owner and member;
// `isOfficeMember` splits them (a member is a company-managed sub-user).
export type TourTier = "free" | "pro" | "office";
export type TourContext = { tier: TourTier; isOfficeMember: boolean };

// Per-step visibility + optional context-aware copy. All omitted = show to all.
type StepVisibility = {
  /** Only these tiers see the step. */
  tiers?: TourTier[];
  /** Office-only: restrict to the owner, or to a member (sub-user). */
  office?: "owner" | "member";
  /** Hide from office sub-users (members) even when their tier matches. */
  excludeMember?: boolean;
};
type TourStepDef = TourStep & {
  vis?: StepVisibility;
  /** Reword the body for this account; falls back to `body` when absent. */
  bodyFor?: (ctx: TourContext) => string;
};

const DASH = "/dashboard";
const SHARE = "/share";
const CONTACTS = "/contacts";
const SETTINGS = "/settings/flows";

const STEP_DEFS: TourStepDef[] = [
  // ── Welcome ───────────────────────────────────────────────────────────────
  {
    id: "welcome",
    path: DASH,
    title: "Welcome to SwiftCard",
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
    id: "nav-links",
    path: DASH,
    anchor: "nav-links",
    title: "Links",
    body: "Your Swift Links page and Swift Signature live here — everything you drop into a bio or the bottom of an email.",
    placement: "bottom",
  },
  // Office OWNER only — the team console (its own quick tour lives inside it).
  {
    id: "nav-admin",
    path: DASH,
    anchor: "nav-admin",
    title: "Your Admin console",
    body: "Manage your whole team here — invite people, see every teammate's leads in one list, and set the branding all your cards share. It has its own quick tour when you open it.",
    placement: "bottom",
    vis: { office: "owner" },
  },
  {
    id: "nav-settings",
    path: DASH,
    anchor: "nav-settings",
    title: "Settings",
    body: "This gear icon opens Cards, integrations, referrals, and your account. The tour ends there.",
    placement: "bottom",
    bodyFor: (ctx) =>
      ctx.isOfficeMember
        ? "This gear icon opens your cards, help, and account. The tour ends there."
        : "This gear icon opens Cards, integrations, referrals, and your account. The tour ends there.",
  },
  // Referrals/rate-us — not for company-managed sub-users.
  {
    id: "nav-grow",
    path: DASH,
    anchor: "nav-grow",
    title: "Help us grow",
    body: "Rate us, invite friends (you earn free Pro months), and spread the word — all in one place.",
    placement: "bottom",
    vis: { excludeMember: true },
    bodyFor: (ctx) =>
      ctx.tier === "office"
        ? "Rate us and help spread the word — all in one place."
        : "Rate us, invite friends (you earn free Pro months), and spread the word — all in one place.",
  },
  {
    id: "notif-bell",
    path: DASH,
    anchor: "notif-bell",
    title: "Notifications",
    body: "Every new contact, save, and milestone across ALL your cards lands here — each tagged with the card it came from. They stay unread until you mark them read.",
    placement: "bottom",
    bodyFor: (ctx) =>
      ctx.tier === "free"
        ? "Every new contact, save, and milestone on your card lands here. They stay unread until you mark them read."
        : "Every new contact, save, and milestone across ALL your cards lands here — each tagged with the card it came from. They stay unread until you mark them read.",
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
    // TourContext carries no viewport, so this copy has to be true on a phone
    // AND on a laptop. On mobile the box now shows only the selected card with
    // an arrow to reveal the rest; on desktop they're all laid out at once —
    // "tap the arrow beside it" is accurate on the phone and simply absent on
    // desktop, which is why it's phrased as an aside rather than an instruction.
    //
    // The FREE branch deliberately says nothing about switching: one card means
    // no arrow is rendered at all.
    body: "All your cards. Pick one and the dashboard follows it — on a phone, tap the arrow beside the selected card to see the rest. Free has one; Pro is unlimited.",
    placement: "bottom",
    bodyFor: (ctx) =>
      ctx.tier === "free"
        ? "Your card. Free includes one — upgrade to Pro for unlimited cards."
        : ctx.tier === "office"
          ? "Your company cards. Pick one and the dashboard follows it — on a phone, tap the arrow beside the selected card to see the rest."
          : "All your cards. Pick one and the dashboard follows it — on a phone, tap the arrow beside the selected card to see the rest. Pro gives you unlimited cards.",
  },
  {
    id: "your-card",
    path: DASH,
    anchor: "your-card",
    title: "Your SwiftCard — try it",
    // "Use Edit above" pointed at a link that no longer exists: editing moved
    // out of the dashboard entirely and lives in Settings → Cards and sharing.
    // A tour that names a missing control is worse than no tour, so this now
    // says where the editor actually is.
    body: "Exactly what people see when you share. To change the template (Photo First is the most popular), colors, photo or links, head to Settings → Cards and sharing.",
    placement: "right",
    interactive: true,
    bodyFor: (ctx) =>
      ctx.isOfficeMember
        ? "Exactly what people see when you share. Your company sets the card's branding — update your own name, title, photo and links in Settings → Cards and sharing."
        : "Exactly what people see when you share. To change the template (Photo First is the most popular), colors, photo or links, head to Settings → Cards and sharing.",
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
    bodyFor: (ctx) =>
      ctx.tier === "free"
        ? "Views of your card and Swift Links. Switch Today / Week / Month. Top locations unlock on Pro."
        : "Views of your card and Swift Links. Switch Today / Week / Month, or tap Locations for top places.",
  },
  // ── Contacts on the dashboard ─────────────────────────────────────────────
  {
    id: "contact-views",
    path: DASH,
    anchor: "contact-views",
    title: "Two quick views",
    body: "Notifications shows the newest activity — tap one to jump straight to that contact. Contacts is your quick list.",
    placement: "top",
  },
  {
    id: "quick-contacts",
    path: DASH,
    anchor: "quick-contacts",
    title: "Quick Contacts",
    body: "One row per contact with Call, Text, and Email buttons — each opens your phone's own dialer, Messages, or mail app with their info filled in. Tap a name to open the full contact.",
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

  // ── Share page — Swift Links + the email signature ────────────────────────
  {
    id: "swift-links",
    path: SHARE,
    anchor: "swift-links",
    title: "Swift Links",
    body: "Your link-in-bio — bio, socials, and links in one page. Drop it in your Instagram or TikTok bio.",
    placement: "bottom",
  },
  {
    id: "email-signature",
    path: SHARE,
    anchor: "email-signature",
    title: "Swift Signature",
    body: "Puts your card at the bottom of every email. Copy it once and paste into Gmail or Outlook — and re-copy it whenever you change your card so it stays in sync.",
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
    body: "The magic: flip on Email or Text, pick a cadence (Light, Medium, Aggressive), and AI writes each message from your notes. Every email is signed with your Swift Signature card. Hit Submit and SwiftCard sends the whole sequence for you — leads never go cold. Email and text run separately.",
    placement: "top",
    bodyFor: (ctx) =>
      ctx.tier === "free"
        ? "Automated follow-up is a Pro feature. On Pro you flip on Email or Text, pick a cadence, and AI writes each message from your notes — SwiftCard then sends the whole sequence for you so leads never go cold. Upgrade to turn it on."
        : "The magic: flip on Email or Text, pick a cadence (Light, Medium, Aggressive), and AI writes each message from your notes. Every email is signed with your Swift Signature card. Hit Submit and SwiftCard sends the whole sequence for you — leads never go cold. Email and text run separately.",
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  {
    id: "settings-cards",
    path: SETTINGS,
    section: "cards",
    anchor: "settings-cards",
    title: "Your cards",
    // This is where the tour lands people now that the dashboard's Edit links
    // are gone, so the step says so outright rather than just listing verbs.
    // The office-member variant finally reaches something: this section used to
    // be hidden from sub-users entirely, which made that branch unreachable.
    body: "This is where you edit a card — open it, rename it, remove it, or add another.",
    placement: "bottom",
    bodyFor: (ctx) =>
      ctx.isOfficeMember
        ? "This is where you edit your company card — your name, title, photo and links. Your company's branding stays locked."
        : "This is where you edit a card — open it, rename it, remove it, or add another.",
  },
  {
    id: "settings-help",
    path: SETTINGS,
    section: "help",
    anchor: "settings-help",
    title: "Help & this tour",
    body: "Ask the built-in assistant anything — and replay this tour from here anytime.",
    placement: "bottom",
  },
  // Referrals — personal-account feature; hidden for the whole Office plan.
  {
    id: "settings-refer",
    path: SETTINGS,
    section: "help",
    anchor: "settings-refer",
    title: "Refer a friend",
    body: "Share your link: 3 sign-ups = a free month of Pro (up to 3). Your friends get a free month too.",
    placement: "bottom",
    vis: { tiers: ["free", "pro"] },
  },
  {
    id: "settings-integrations",
    path: SETTINGS,
    section: "notifications",
    anchor: "settings-integrations",
    title: "Integrations",
    body: "Connect GoHighLevel, Pipedrive, HubSpot, Google Contacts or Zapier so new leads sync to your tools automatically.",
    placement: "bottom",
  },
  {
    id: "settings-general",
    path: SETTINGS,
    section: "profile",
    anchor: "settings-general",
    title: "General",
    body: "Your email, cards, and current plan at a glance.",
    placement: "bottom",
  },
  // Billing — hidden for sub-users (their plan is managed by the company).
  {
    id: "settings-billing",
    path: SETTINGS,
    section: "billing",
    anchor: "settings-billing",
    title: "Billing",
    body: "Change plan, manage Office seats, or cancel — and if you ever schedule a cancellation, one tap brings it back.",
    placement: "bottom",
    vis: { excludeMember: true },
    bodyFor: (ctx) =>
      ctx.tier === "free"
        ? "Upgrade to Pro or Office, and manage your plan here anytime."
        : ctx.tier === "office"
          ? "Change your plan, manage Office seats, or cancel — and if you ever schedule a cancellation, one tap brings it back."
          : "Change your plan or cancel — and if you ever schedule a cancellation, one tap brings it back.",
  },

  // ── Finish ────────────────────────────────────────────────────────────────
  {
    id: "finish",
    path: SETTINGS,
    title: "You're all set",
    body: "That's the whole app. Now go share your card and watch your contacts roll in.",
  },
];

// Strip the build-only metadata, optionally rewording the body for `ctx`.
function toStep(def: TourStepDef, ctx?: TourContext): TourStep {
  const { vis: _vis, bodyFor, ...step } = def;
  void _vis;
  return ctx && bodyFor ? { ...step, body: bodyFor(ctx) } : step;
}

function isVisible(vis: StepVisibility | undefined, ctx: TourContext): boolean {
  if (!vis) return true;
  if (vis.tiers && !vis.tiers.includes(ctx.tier)) return false;
  if (vis.excludeMember && ctx.isOfficeMember) return false;
  const isOfficeOwner = ctx.tier === "office" && !ctx.isOfficeMember;
  if (vis.office === "owner" && !isOfficeOwner) return false;
  if (vis.office === "member" && !ctx.isOfficeMember) return false;
  return true;
}

// The plan-accurate step list the running tour uses.
export function buildTourSteps(ctx: TourContext): TourStep[] {
  return STEP_DEFS.filter((d) => isVisible(d.vis, ctx)).map((d) => toStep(d, ctx));
}

// Full base list (every step, base copy) — used by tests and as the fallback
// when the running tour has no account context yet.
export const TOUR_STEPS: TourStep[] = STEP_DEFS.map((d) => toStep(d));

// Dashboard/Contacts steps should stay on the card the tour started with, so the
// dashboard doesn't bounce to the card picker mid-tour. Settings steps carry
// their section as a #hash so SettingsShell opens the right panel on arrival.
export function resolveTourPath(step: TourStep, card: string | null): string {
  if ((step.path === "/dashboard" || step.path === "/contacts" || step.path === "/share") && card) {
    return `${step.path}?card=${encodeURIComponent(card)}`;
  }
  if (step.section) return `${step.path}#${step.section}`;
  return step.path;
}
