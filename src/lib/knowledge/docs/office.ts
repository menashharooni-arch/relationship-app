import { defineDocs } from "../types";

// The Office admin console.
//
// The assistant this replaces sent admins looking for a "Resend invite" button
// in the person drawer and a role picker — neither of which exists. Every
// location below is the real one.
//
// (The Leads export was in that list until it was built; the Leads doc below
// now describes the real button. A role picker still does not exist: every
// member is an "employee", and nothing in the product can change that.)

export const officeDocs = defineDocs([
  {
    id: "admin-console",
    title: "Getting into the admin console",
    audience: ["user", "office-admin"],
    triggers: [
      "admin console", "admin", "office admin", "team console", "manage my team",
      "where is admin", "open admin",
    ],
    answer:
      "The purple \"Admin\" link in the dashboard top bar (or the Admin tab in the mobile bottom bar) opens /office/admin. It has four tabs: Team, Analytics (/office/admin/analytics), Leads (/office/admin/leads) and Branding (/office/admin/branding). \"← My dashboard\" in the header takes you back to your own side.",
    detail:
      "The link only appears for people who can actually open the console — the office owner, or a teammate with a role that grants it. A brand-new Office subscriber is first asked to \"Name your team\" and is then sent to their own dashboard, not into the console, which surprises people; they get in via the Admin link afterwards. Old bookmarks to /office, /office/admin/team, /office/admin/cards and /office/admin/invite all now land on the Team tab, because Overview, Cards and Invite were folded into it.",
  },
  {
    id: "invite-teammate",
    title: "Inviting someone to the team",
    audience: ["office-admin", "user"],
    triggers: [
      "invite", "invite a member", "invite teammate", "invite employee", "add a member",
      "add member", "add teammate", "add employee", "add someone", "onboard", "send invite",
      "new hire",
    ],
    answer:
      "Team tab → the purple \"+ Add team member\" button at the top right. Enter their email (a name is optional) and press \"Send invite\". They get a passwordless invitation — they sign in with Google or a one-tap email link and their card arrives already branded with your company look. When their card goes live they can turn on notifications, and their dashboard then opens with the same short guided tour every new account gets. The invite email has one button, \"Create my card\" — the iPhone app is offered after the card is live, not before. If they sign in to SwiftCard some other way first (for example they install the app and sign in with Google using the invited address), the dashboard shows \"You're invited to <team>\" with a Join button, and a brand-new account is sent straight to that Join step instead of being asked to build a personal card.",
    detail:
      "Invitations expire after 14 days and a pending one holds a seat until it's accepted, retracted, or expires. If you're out of seats, the dialog says so and offers to add one: on the web it shows the price for the new seat, the prorated amount charged today and the new monthly total, and \"Pay & add seat\" charges the card on file and sends the invite in one step. In the iPhone app it offers \"Add a seat on swiftcard.me\", which opens your browser to Settings \u2192 Plan and billing \u2014 seats are bought on the web, never inside the app. Either way you can also free a seat by removing a member or retracting a pending invite. The invite only works for the exact address it was sent to.",
  },
  {
    id: "resend-or-cancel-invite",
    title: "Chasing or cancelling an invitation",
    audience: ["office-admin"],
    triggers: [
      "resend", "resend invite", "resend an invite", "resend the invite", "invite again",
      "they didnt get", "didn't get the invite", "send invite again", "pending invite",
      "not finished", "hasnt finished", "remind", "remind them", "retract", "cancel invite",
      "revoke invite", "chase an invite",
    ],
    answer:
      "On the Team tab, pending invitations sit in the same roster as your members. The row has a \"Remind\" button that re-sends the email and restarts the 14-day clock, and \"Manage\" opens an inline confirmation to retract the invite and free the seat.",
    detail:
      "The button is labelled \"Remind\", not \"Resend invite\" — sending someone hunting for \"Resend invite\" is a wasted trip, and there is no resend control inside the person drawer either. Roster status chips you'll see: Active, Card not completed, Card deactivated, Not using it yet, Pending, and Invite expired.",
  },
  {
    id: "manage-remove-member",
    title: "Managing or removing a teammate",
    audience: ["office-admin"],
    triggers: [
      "remove", "remove member", "remove teammate", "remove employee", "delete member",
      "someone left", "offboard", "manage member", "edit member card", "edit their card",
      "take card offline", "deactivate card",
    ],
    answer:
      "Team tab → click a person or their \"Manage\" button to open their drawer: their stats, their card, \"View live card\", \"Copy card link\", \"Show QR code\", \"Edit card\", and \"Remove from team\". Removing them turns their company cards off and frees the seat — their leads stay with the office.",
    detail:
      "\"Manage\" also opens a fuller page for that person at /office/admin/team/<their id>, listing their cards, and \"Edit card\" from there opens the card itself at /office/admin/cards/<card id> where it can be edited or taken offline. Taking a card offline (or removing the person) stops the public page, the QR code, NFC cards and the wallet pass from working. Nothing is deleted: their contacts and history remain, and the company branding is stripped from the card they walk away with so they can bring it back online themselves.",
  },
  {
    id: "team-analytics",
    title: "Team analytics",
    audience: ["office-admin"],
    triggers: [
      "analytics", "stats", "performance", "views", "who is performing", "per person",
      "per employee", "team performance", "conversion", "scans", "unique visitors",
      "export analytics", "team report",
    ],
    answer:
      "The Analytics tab, with a 7 / 30 / 90-day range picker. Seven tiles — Total views, Unique visitors, Card/QR scans, Leads captured, Contact downloads, SwiftLink views and Conversion rate — then a views-over-time chart, traffic sources, and a sortable \"Team performance\" table per person. \"Export CSV\" there is the only export in the console.",
    detail:
      "Two things to read correctly: \"Total views\" already includes Swift Links views, so the SwiftLink tile is a breakdown of it rather than a number to add on. And \"Export CSV\" always exports the full date range, not just the rows left after you've typed in the search box. Clicking an employee's name opens their own analytics page at /office/admin/analytics/<their id>, with the same tiles for just that person.",
  },
  {
    id: "team-leads",
    title: "The team's leads",
    audience: ["office-admin"],
    triggers: [
      "leads", "our leads", "team leads", "all leads", "see leads", "where are the leads",
      "who contacted", "lead status", "pipeline", "export leads", "download leads",
    ],
    answer:
      "The Leads tab lists everyone who shared their info with anyone on the team, with a search box, a team-member filter and a status filter. Each row has a Status dropdown — New, Contacted, Closed, Not interested — and this is the only place in the product where a lead's status can be set. Above the table it says how many are on screen out of the team's exact total, with an \"Export all as CSV\" button beside it, and a \"Load more\" button under the table brings in the next page.",
    detail:
      "\"Export all as CSV\" sits at the top right of the Leads tab and downloads EVERY lead the office owns — name, email, phone, who captured it, its status and the date — not just the page on screen. It is separate from the Analytics tab's CSV, which exports per-person performance figures rather than the leads themselves. The search and the two filters only look at the leads currently loaded, so tell an admin to press \"Load more\" or use the export when they are hunting for something older. Leads stay with the office when the person who captured them leaves, and show as captured by \"Former team member\".",
  },
  {
    id: "company-branding",
    title: "Company branding — cards and Swift Links",
    audience: ["office-admin"],
    triggers: [
      "brand swift links", "brand the links page", "links branding", "swiftlinks design for team",
      "same links page", "team links page", "company instagram", "team bio", "company links",
      "branding", "logo", "company logo", "company name", "brand", "our look", "company look",
      "set branding", "upload logo", "change logo", "company info", "office contact",
      "company address", "company phone", "design lock", "lock design", "uniform",
      "stop employees changing",
    ],
    answer:
      "The Branding tab. Section one is company information — logo, company name, website and office contact details, all identical on everyone's card. Section two is the card design every teammate shares: the template, its colours and font, the Finish laid over the card background, and a panel photo or video with its Darken setting — the same controls a teammate would see on their own \"Card design\" tab. Saving re-applies the look to every active teammate's card automatically.",
    detail:
      "The control people call the \"design lock\" is a checkbox reading \"Keep every card matching\", and it is ON by default — that name appears nowhere in the UI, so describe the checkbox. While it is on, a teammate opening their own \"Card design\" tab sees a \"Managed by your organization\" note instead of the controls. Unchecking it lets each teammate choose their own template, colours, finish and panel background, while the logo, company name and contact details stay company-controlled either way. Branding governs your TEAMMATES' cards; your own personal card stays yours and is not overwritten. THE BRANDING PAGE HAS TWO TABS at the top, \"Card\" and \"Links\": everything above is the Card tab. The Links tab brands the Swift Links page (the link-in-bio page a QR code or an email signature opens) and mirrors it exactly — 1 Links information (a bio, the company Instagram, and company link buttons), 2 Links appearance (the same design controls teammates see under Social design, with a live preview), 3 What team members can edit, with a checkbox reading \"Keep every Swift Links page matching\" and a \"Save & apply to all Swift Links\" button. The two tabs save separately, so working on one never changes the other. What the Links tab takes is narrow and worth stating plainly: a bio you write, the Instagram you set, and the company link buttons you pin. Company links are ADDITIVE — they sit at the top of every teammate's page and cannot be edited or removed by them, but each teammate can still add their own links underneath, and every other social stays theirs to fill in. \"Keep every Swift Links page matching\" covers the DESIGN only, and it is OFF by default so an office that never opens this tab keeps the pages its teammates already built.",
  },
  {
    id: "office-roles",
    title: "Roles and permissions",
    audience: ["office-admin"],
    triggers: [
      "role", "roles", "make admin", "assign role", "permission", "permissions", "manager",
      "billing admin", "give access", "make someone admin", "promote",
    ],
    answer:
      "Roles exist behind the scenes — owner, admin, manager, billing admin and employee — but there is currently no screen anywhere in the console for assigning one. If you need a teammate promoted to admin, contact the team through the Contact page; it isn't something you can do yourself yet.",
    detail:
      "Say this plainly rather than describing a picker. There is no role dropdown in the person drawer, the team page, or settings. What the roles grant when set: admin can invite and remove members, manage branding, edit member cards and view analytics; manager can view analytics only; billing admin can handle billing and seats; employee manages only their own card. The owner has everything.",
  },
  {
    id: "office-employee-experience",
    title: "What a teammate sees",
    audience: ["office-admin", "user"],
    triggers: [
      "what can employees do", "employee view", "sub user", "team member access",
      "can they see", "employee permissions", "what do my staff see",
    ],
    answer:
      "A teammate gets their own dashboard, contacts, Swift Links and card editor — but not the admin console. The company-managed fields on their card (logo, company name, website, office contact details) show as \"Managed by your organization\" and can't be edited by them.",
    detail:
      "They also lose a few things a normal account has: no referral programme, no account deletion, and no card deletion. Their contacts stay private to them — the office sees lead counts and the combined Leads tab, not their personal contact notes.",
  },
  {
    id: "admin-tour-and-notifications",
    title: "The console's tour and notifications",
    audience: ["office-admin"],
    triggers: ["tour", "walkthrough", "replay tour", "team notifications", "admin bell", "notifications"],
    answer:
      "The purple \"Tour\" pill at the top of the Team tab replays a short walkthrough of all four tabs. The bell in the console header is a separate, deliberately quiet inbox: it only carries someone joining the team, someone leaving, and a declined invitation.",
    detail:
      "The team bell does not carry leads, card views or milestones — those stay on your personal dashboard's bell. This is the console's own tour, separate from the main product one.",
  },
]);
