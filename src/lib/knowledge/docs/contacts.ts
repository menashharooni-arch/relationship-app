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
      "\"Contacts\" in the top nav (or the Contacts tab in the mobile bottom bar) opens /contacts. It lists everyone captured by the card you currently have selected, with a search box that matches name, email, phone and company, and a sort dropdown offering Alphabetical, Recently Added, Follow-up Date, and (on Pro) Follow Up First.",
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
    id: "share-your-card-with-a-contact",
    title: "Sharing your card with a contact",
    audience: ["user"],
    triggers: [
      "share my card", "share button", "send my card", "send my contact information",
      "share contact info", "share by text", "share by email", "share by both",
      "share from my phone", "prefilled message", "pre-filled", "now email",
      "who is the email from", "via swiftcard", "went to spam", "spam folder",
    ],
    answer:
      "The Share button on an open contact has four options. Three of them use your own phone: \"Share by text\" opens Messages already addressed to that contact with the message and your card link written, so you just press send; \"Share by email\" opens your mail app already addressed to them with the subject, the message and your signature written; \"Share from my phone\" opens the phone's share sheet with just the card link, for WhatsApp, AirDrop or anything else. \"Share by both\" is different — SwiftCard sends the text and the email for you, straight away, without opening any app. The button shows \"Sending…\", then tells you what went: \"Texted and emailed them\", or exactly which one went and why the other didn't.",
    detail:
      "Text and email leave from your own number and mailbox, so they arrive from you — no \"via SwiftCard\" line, and nothing for a spam filter to object to. Those two don't appear in the contact's Conversation tab, because SwiftCard can't see whether you pressed send. \"Share by both\" does show up there, one entry for the text and one for the email, because we sent them: the text comes from the SwiftCard number and ends with \"Reply STOP to opt out\", and the email comes from your name with your card underneath. It works this way because a phone can only open one app per tap — the old version opened Messages and asked you to come back for the email, and the email half usually never got sent. \"Share by both\" is greyed out unless the contact has both a phone and an email; if you've switched texts off for someone, they get the email only and the button says so. Tapping twice can't send twice.",
  },
  {
    id: "personal-link",
    title: "Your personal link for a contact",
    audience: ["user"],
    triggers: [
      "personal link", "copy personal link", "tracked link", "ct=", "why is there a code in my link",
      "know when they come back", "recognise a contact", "returning contact",
    ],
    answer:
      "Open a contact and tap \"Copy personal link\" under the Call / Share / Save buttons. It copies your card's address with a short code on the end that belongs to that one contact. Paste it into anything you send them yourself (WhatsApp, LinkedIn, your own email). When they open it, SwiftCard knows that phone or computer is theirs, so their later visits show up on their contact.",
    detail:
      "Texts and emails SwiftCard sends for you (follow-up automations, messages from the Conversation tab, \"Share by both\") already carry the contact's own link, so you don't need to add it. The code is removed from the address bar as soon as the page opens, so if they copy the address and send it on, the code doesn't go with it. If they forward your original message and up to two more devices open it, those visits are shown as \"your link was opened on another device\", never under the contact's name. Link-checking robots in email systems don't count, because nothing is recorded until a real person has had the card open for a couple of seconds. If someone unsubscribes from email, their links stop recognising anyone.",
  },
  {
    id: "returning-contact-alerts",
    title: "When a contact comes back to your card",
    audience: ["user"],
    triggers: [
      "re-opened your card", "came back", "returning contact", "wrong person", "not them",
      "stop alerts for a contact", "mute a contact", "alert me when they come back",
    ],
    answer:
      "When someone you already have as a contact opens your card again, the notification names them (\"Priya re-opened your card\") and tapping it opens their contact. Each contact has an \"Alert me when they come back\" switch under the Call / Share / Save buttons; turning it off keeps their visits in the bell and in their history but stops the phone alert.",
    detail:
      "SwiftCard only recognises someone who shared their details with you from that phone or computer, or who opened a personal link you sent them. If a named notification was about the wrong person, tap \"Wrong person?\" on it in the dashboard's Notifications list, then Confirm: that device is no longer tied to the contact, those visits come off their history, and the notification is removed. If two different people have shared their details from the same device (a shared iPad, say), SwiftCard names neither of them. Contacts marked Not interested or Closed never set off a phone alert. On the Free plan the name is blurred and the alert says \"A contact re-opened your card\"; where you met them still shows, but tapping the alert opens the Notifications list rather than the contact, and there is no \"Wrong person?\" on it.",
  },
  {
    id: "hot-warm-contacts",
    title: "Hot and Warm contacts",
    audience: ["user"],
    triggers: [
      "hot", "warm", "cold", "hot contact", "warm contact", "follow up first", "intent",
      "score", "who should i follow up with", "warming up",
    ],
    answer:
      "On Pro, contacts who have come back to your card recently get a red \"Hot\" or amber \"Warm\" badge in the Contacts list and on their contact, with a short reason underneath, such as \"viewed 3× this week, tapped Calendly\". Choose \"Follow Up First\" in the sort dropdown to put them at the top, or tap the Hot / Warm chips under it to show only those.",
    detail:
      "The badge comes from what the contact actually did in the last 30 days: coming back to your card, tapping your links (a booking or listing link counts for more), downloading your contact card again, and replying to your messages. Recent activity counts for more than older activity, and Hot also needs something in the last three days. The visit where they first shared their details doesn't count; a contact is only Warm once they come back. Contacts with nothing recent have no badge at all. It only counts visits SwiftCard knows were them (they shared from that device, or opened a personal link you sent), and never counts a visit you marked \"Wrong person?\". On the Free plan the list says how many contacts are warming up, without naming them. The old \"Recent Activity\" sort is now called \"Follow-up Date\", which is what it always sorted by.",
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
      "The messages are AI-written from that contact's \"Where did you meet?\" and Notes, so a contact with neither gets generic copy — fill those in first. A channel with nothing to send to is disabled (\"No email on file for this contact\"). Texts only send if that person ticked the SMS consent box themselves when they shared their info; without it the text channel cannot be switched on, whatever the plan. Free accounts get no AI-written messages at all — AI drafting is Pro-only.",
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
      "When a Free account's last free contact of the month comes in, the bell says so once (\"That's {limit.leads} of {limit.leads} new contacts this month\") — never as a phone notification — so the next one being held back is not a surprise. The visitor never sees a failure — their share always succeeds. The counter resets on the 1st and counts per account, so deleting a card or a contact doesn't reset it. The same holds after a downgrade: contacts are hidden, never deleted.",
  },
]);
