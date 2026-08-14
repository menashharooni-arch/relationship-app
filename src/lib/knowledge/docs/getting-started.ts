import { defineDocs } from "../types";

// Signing in, signing up, and the first few minutes of an account.

export const gettingStartedDocs = defineDocs([
  {
    id: "signing-in",
    title: "Signing in",
    audience: ["user"],
    triggers: [
      "sign in", "log in", "login", "cant log in", "can't log in", "cant sign in",
      "locked out", "google sign in", "apple sign in", "magic link", "login link",
    ],
    answer:
      "/login has two tabs, \"Sign in\" and \"Create account\", plus Google and Apple buttons. If a password isn't working, use \"Forgot password?\" on the Sign in tab — type your email in the box first, then tap the link.",
    detail:
      "Some traps worth knowing. There is no passwordless \"email me a login link\" on the normal login page — that exists only for team invitations, so if someone asks for a login link, the honest answer is that everyone else signs in with a password or with Google/Apple. Tapping Google while the \"Sign in\" tab is selected, with no account on that address, bounces back with \"You don't have an account yet\" and switches to Create account — it does not silently create one. And the sign-in error message is deliberately vague about whether an email exists at all, so \"it says wrong password\" doesn't prove the account exists.",
  },
  {
    id: "creating-an-account",
    title: "Creating an account",
    audience: ["user"],
    triggers: [
      "create an account", "new account", "sign up", "register", "password requirements",
      "make an account",
    ],
    answer:
      "Either build a card first at /cards/new and create the account when you save it, or go straight to /login → \"Create account\". Passwords need at least 6 characters; there are no other rules. Google and Apple sign-up work from the same screen.",
    detail:
      "New accounts start on Free — there is no automatic trial for signing up. The trial exists only when someone actively subscribes to Pro. A new account has zero cards and shows \"Let's create your first card\".",
    commerce: true,
    nativeAnswer:
      "Either build a card first and create the account when you save it, or use \"Create account\" on the sign-in screen. Passwords need at least 6 characters. Google and Apple sign-up work from the same screen.",
  },
  {
    id: "guest-draft",
    title: "Building a card before you have an account",
    audience: ["visitor", "user"],
    triggers: [
      "without an account", "guest", "draft", "lost my card", "lost my work",
      "card disappeared", "didnt save", "didn't save", "my work is ready",
    ],
    answer:
      "You can build a whole card at swiftcard.me/cards/new with no account — the draft lives in your browser until you choose a plan, at which point a \"Your work is ready\" prompt asks you to create an account or log in, and the card is saved.",
    detail:
      "Two ways that draft is lost, both worth checking before assuming a fault. It is browser-local, so it doesn't follow you to another device or survive clearing site data — and going back to the homepage clears it deliberately. And the save has to happen within an hour of the account prompt: sign in much later and you land on the dashboard without the card. The prompt appears even if you're already signed in, on purpose, so a card is never quietly saved into whichever account happened to be open.",
  },
  {
    id: "first-card-and-welcome",
    title: "What happens right after your first card",
    audience: ["user"],
    triggers: ["welcome", "first card", "just signed up", "card is live", "what now", "next steps"],
    answer:
      "You land on a \"Your card is live!\" screen (/welcome) with your card URL, an offer to turn on notifications, and — if you picked a paid plan while building — a link on to /checkout to finish it. After that the dashboard opens with a short guided tour.",
    detail:
      "If the card was designed with Pro-only colours but Free was chosen, a note explains the content is saved and the design falls back to a Free-safe version; nothing is lost.",
  },
  {
    id: "team-invite",
    title: "Joining a team you were invited to",
    audience: ["user"],
    triggers: [
      "invite", "invited", "join a team", "invitation", "invite link", "join link",
      "accept invite", "my company invited me", "expired invite",
    ],
    answer:
      "Open the invitation link you were emailed (it looks like swiftcard.me/join/…) and sign in as the invited address — with Google, or with \"Email me a sign-in link\", which is the one place SwiftCard does passwordless sign-in. Your card comes pre-branded with the company look, and you fill in your own details.",
    detail:
      "Invitations expire after 14 days; an admin can resend from the Team tab of the admin console. You must sign in as the address that was invited — a different account won't accept it. There is no special short team form any more: team members go through the same four-step card builder as everyone else, with the company-managed fields shown as \"Managed by your organization\".",
  },
  {
    id: "which-pages-need-an-account",
    title: "Pages that need you to be signed in",
    audience: ["visitor", "user"],
    triggers: ["do i need to log in", "requires login", "signed out", "why am i on the login page"],
    answer:
      "The dashboard, contacts, settings, the Links page and the admin console all need an account. The card builder at swiftcard.me/cards/new is deliberately open, and so are the marketing pages, the templates gallery and the live demo.",
    detail:
      "swiftcard.me/share and swiftcard.me/grow are commonly mistaken for public marketing pages; they aren't, and a signed-out visitor opening them lands on the login screen.",
  },
]);
