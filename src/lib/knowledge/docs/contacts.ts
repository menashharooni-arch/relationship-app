import { defineDocs } from "../types";

// Contacts: how they arrive, what you can do with them, and the follow-up
// automations that run off them.

export const contactsDocs = defineDocs([
  {
    id: "contacts-page",
    title: "Finding your contacts",
    audience: ["user"],
    triggers: [
      "contacts", "leads", "my leads", "see contacts", "where are my contacts",
      "who saved my card", "view contacts", "contact list", "find a contact", "search contacts",
    ],
    answer:
      "\"Contacts\" in the top nav (or the Contacts tab in the mobile bottom bar) opens /contacts. It lists everyone captured by the card you currently have selected, with a search box that matches name, email, phone and company, and a sort dropdown offering Alphabetical, Recently Added, or Recent Activity.",
    detail:
      "Contacts are per card and there is deliberately no \"All cards\" option on this page — the grey line above the search box tells you which card you're looking at. To see another card's contacts, switch the selected card on the dashboard. A brand-new card comes with one seeded sample contact, \"Jordan Rivera\", so the screens aren't empty; it is not a real person and deleting it is safe.",
  },
  {
    id: "add-contact",
    title: "Adding a contact yourself",
    audience: ["user"],
    triggers: [
      "add contact", "add a contact", "enter a contact", "manual contact", "type in a contact",
      "new contact",
    ],
    answer:
      "The blue \"Add contact\" button at the top of the Contacts list, or the same button in the dashboard's \"Quick Contacts\" header. The form asks for Full name (required), Email, Phone, Company, \"Where you met\" and Notes.",
    detail:
      "Contacts you add by hand are not marked unread, so they never show the blue dot — only shares through your card do. They count towards the Free monthly contact cap just like captured ones. The source badge shows \"Added by hand\".",
  },
  {
    id: "card-scanner",
    title: "Scanning a paper business card",
    audience: ["user"],
    triggers: [
      "scan", "scanner", "scan a business card", "scan card", "camera", "ocr",
      "photo of a card", "business card scanner",
    ],
    answer:
      "Open \"Add contact\" and tap \"Scan a business card\" at the top of the modal — take a photo and the name, email, phone and company fill themselves in, ready for you to check and save. It's a Pro feature.",
    detail:
      "There's no separate Scanner page or tab; the Add contact modal is the only way in. It fills the form but does not save on its own — you still press Add contact. Job title and website are read but not transferred into the form. There is no free scan allowance at all: it is Pro from the first scan.",
  },
  {
    id: "read-unread",
    title: "Read and unread contacts",
    audience: ["user"],
    triggers: ["read", "unread", "mark read", "mark as read", "mark unread", "blue dot", "envelope"],
    answer:
      "New contacts who shared their info arrive unread, shown by a blue dot and a filled envelope. Tap the envelope on the row, or the pill at the top of an open contact, to switch between read and unread.",
    detail:
      "There is no \"mark all as read\" on the Contacts page and no filter for unread only. Contacts you added yourself or scanned are never flagged unread.",
  },
  {
    id: "contact-detail",
    title: "What's inside a contact",
    answer:
      "Open a contact and you get Call, Share and \"Save to phone\" buttons, then two tabs: \"Conversation\" (a read-only timeline of their activity and every message sent to them) and \"Contact info / Presets\" (their details, Notes, \"Where did you meet?\", and the follow-up automations).",
    audience: ["user"],
    triggers: [
      "conversation", "message", "they sent", "what they wrote", "their message",
      "contact details", "edit a contact", "contact notes", "where did you meet",
    ],
    detail:
      "The Conversation tab is read-only — there is no reply box anywhere in Contacts, so you cannot send a one-off message from SwiftCard; use Call, or the Share menu, or your own phone. Editing under \"CONTACT INFO\" covers Name, Company, Email and Phone only; the source badge and the date added can't be changed. Notes and \"Where did you meet?\" are worth filling in properly, because they are exactly what the AI reads when it writes follow-up messages. There is no status or pipeline dropdown on this page.",
  },
  {
    id: "follow-up-automations",
    title: "Automated follow-up sequences",
    audience: ["user"],
    triggers: [
      "follow up", "followup", "follow-up", "automation", "automations", "sequence",
      "sequences", "ai message", "ai follow up", "generate message", "write a message",
      "drip", "cadence", "light medium aggressive",
    ],
    answer:
      "Open a contact → \"Contact info / Presets\" tab → \"FOLLOW-UP AUTOMATIONS\". Email and Text are separate switches and you can run either or both. Flip one on, choose a cadence — Light (2 touches), Medium (3) or Aggressive (4) — and SwiftCard writes and sends the messages for you. Automated sequences are a Pro feature.",
    detail:
      "The messages are AI-written from that contact's \"Where did you meet?\" and Notes, so a contact with neither gets generic copy — fill those in first. A channel with nothing to send to is disabled (\"No email on file for this contact\"). Texts only send if that person ticked the SMS consent box themselves when they shared their info; without it the text channel cannot be switched on, whatever the plan. Free accounts get a small monthly allowance of AI drafts ({limit.drafts} a month) but not the automated sending.",
  },
  {
    id: "export-contacts",
    title: "Exporting contacts",
    audience: ["user"],
    triggers: [
      "export", "csv", "download contacts", "export contacts", "spreadsheet", "excel",
      "backup my contacts", "import contacts",
    ],
    answer:
      "\"Export CSV\" at the top of the Contacts page, next to the contact count. It downloads name, email, phone, company, status, notes, follow-up date and date added, newest first — the selected card's contacts, or all of them if no card is selected. Export is a Pro feature.",
    detail:
      "The button only appears once you have at least one contact, and it's limited to a handful of exports per ten minutes. There is no import — contacts cannot be bulk-loaded from a file, they have to be captured, added by hand, or scanned.",
  },
  {
    id: "delete-contact",
    title: "Deleting a contact",
    audience: ["user"],
    triggers: ["delete contact", "remove contact", "delete a lead", "get rid of a contact"],
    answer:
      "Open the contact and use the red \"Delete contact\" link at the bottom, then confirm. It's permanent — there's no undo and no trash.",
    detail:
      "Deleting does not give back a slot in the Free monthly contact meter; that counter tracks contacts captured during the month, not contacts currently held. Deleting a CARD is far more destructive: it also deletes every contact that card captured, along with their message history — export first if there's any doubt.",
  },
  {
    id: "locked-contacts",
    title: "Contacts that are locked or hidden",
    audience: ["user"],
    triggers: [
      "locked", "locked contacts", "hidden contacts", "blurred", "waiting for you",
      "missing contacts", "cant see my leads", "where did my leads go",
    ],
    answer:
      "On Free, contacts captured beyond {limit.leads} in a month are still captured and stored — they're just held back until the account is on a paid plan, with a banner telling you how many are waiting. Nothing is lost, and they all appear the moment the account is paid.",
    detail:
      "The visitor never sees a failure — their share always succeeds. The counter resets on the 1st and counts per account, so deleting a card or a contact doesn't reset it. The same holds after a downgrade: contacts are hidden, never deleted.",
  },
]);
