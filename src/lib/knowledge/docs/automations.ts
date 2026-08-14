import { defineDocs } from "../types";

// How automated follow-ups actually behave once they're running — the part
// support gets asked about after setup, not during it.

export const automationDocs = defineDocs([
  {
    id: "when-follow-ups-send",
    title: "When automated follow-ups actually go out",
    audience: ["user"],
    triggers: [
      "when will it send", "why hasnt it sent", "why hasn't it sent", "not sent yet",
      "sending time", "what time", "schedule", "delayed", "didnt send", "didn't send",
    ],
    answer:
      "Sends are processed once a day, so a step goes out on the day it falls due rather than at a precise clock time. The times shown next to each cadence (10:06 AM and so on) describe the shape of the schedule, not the minute the message leaves.",
    detail:
      "The daily run is in the evening UTC. Texts have an extra restriction: they only go out inside a window that is between 8am and 9pm across every US timezone, so a text due on a day the run falls outside that window waits for the next one. Email has no such restriction. If someone is waiting on a message that hasn't arrived, check first whether the step is even due yet — each step in the contact's automation panel shows \"Sends <date>\" or \"Sent <date>\".",
  },
  {
    id: "editing-drafts",
    title: "Editing the messages before they send",
    audience: ["user"],
    triggers: [
      "edit the message", "change the message", "draft", "drafts", "regenerate",
      "rewrite", "submit and activate", "preview the messages", "subject line",
    ],
    answer:
      "After you pick a cadence, every step appears as an editable draft — text you can rewrite, and for email a subject line too. \"Regenerate ↺\" asks the AI for another version. Nothing is scheduled until you press \"Submit & activate\".",
    detail:
      "So a sequence sitting in draft has not started; people sometimes assume picking the cadence was enough. Re-submitting a sequence that is part-way through keeps the steps that already went out, so nothing double-sends.",
  },
  {
    id: "pausing-automations",
    title: "Pausing, resuming and resetting a sequence",
    audience: ["user"],
    triggers: [
      "pause", "stop the follow ups", "stop follow-ups", "turn off automation",
      "resume", "restart", "reset automation", "stop sending",
    ],
    answer:
      "The switch on the \"Email automation\" or \"Text automation\" row pauses just that channel — steps stop and stay unsent, and switching it back on picks up where it left off. \"Reset ↺\" (visible only when the channel is off) clears that channel's messages so you can choose a new cadence.",
    detail:
      "One thing worth knowing: turning the TEXT switch off does more than pause it — it also withdraws that contact's SMS consent, which blocks manual texts to them as well. Turning it back on does not restore consent by itself; the contact has to opt in again. Email and text are independent, so pausing one leaves the other running.",
  },
  {
    id: "what-stops-a-sequence",
    title: "Why a sequence stopped on its own",
    audience: ["user"],
    triggers: [
      "sequence stopped", "automations stopped", "follow ups stopped", "paused by itself",
      "why did it stop", "sequences paused",
    ],
    answer:
      "A sequence skips steps if the contact was marked \"Closed\" or \"Not interested\", if the card it came through was taken offline, if the recipient replied STOP or unsubscribed, or if the account dropped to Free. Nothing is deleted — the steps stay unsent and resume if the cause is reversed.",
    detail:
      "A downgrade sends one in-app notification titled \"Follow-up sequences paused\". Re-subscribing resumes everything automatically, from where it stopped.",
  },
  {
    id: "what-messages-look-like",
    title: "What the emails and texts look like to the recipient",
    audience: ["user"],
    triggers: [
      "what does it look like", "who is it from", "sender", "from address", "reply to",
      "my own number", "my phone number", "branding on emails", "via swiftcard",
    ],
    answer:
      "Emails come from your name on SwiftCard's verified address, with replies going to your own card email. Texts come from one shared SwiftCard number — never your own — signed with your name and company, with your card link.",
    detail:
      "Two things a paid plan does not change, and it's worth saying so plainly. The unsubscribe link in follow-up emails is never removed on any plan; it's a legal requirement, not branding. And texts always identify SwiftCard, because Swift Card Inc is the registered sender for the messaging campaign — a paid plan removes SwiftCard's own branding from the message body, not that identification. You cannot send from your own phone number.",
  },
  {
    id: "stop-and-unsubscribe",
    title: "STOP, unsubscribes, and opted-out recipients",
    audience: ["user"],
    triggers: [
      "stop", "they replied stop", "opted out", "opt out", "unsubscribed", "cant text them",
      "blocked", "not receiving", "they unsubscribed",
    ],
    answer:
      "If someone replies STOP to a SwiftCard text, that number stops receiving SwiftCard texts entirely — from every user, not just you — until they reply START. Clicking Unsubscribe in a follow-up email does the same for that email address across the platform. Neither one is something you can undo from your side.",
    detail:
      "STOP does not stop emails, and unsubscribing from emails does not stop texts; they're separate lists. If a contact says they aren't getting your messages, an earlier STOP or unsubscribe from a different SwiftCard user is a real possibility. They opt back in themselves — by replying START, or by ticking the consent box again next time they share their info.",
  },
  {
    id: "replies-and-delivery",
    title: "Replies and delivery status",
    audience: ["user"],
    triggers: [
      "reply", "replies", "did they reply", "delivered", "delivery", "failed to send",
      "not delivered", "did it send", "can i reply",
    ],
    answer:
      "When someone texts back, their reply appears in that contact's \"Conversation\" tab. Each message you've sent shows a status underneath — Sending, Sent, Delivered, Not delivered or Failed. The conversation is read-only, so you can't reply from inside SwiftCard; use the Call button or your own phone.",
    detail:
      "\"Sent\" means the carrier accepted it, not that it landed — don't promise delivery on \"Sent\" alone; \"Delivered\" is the one that confirms it. A reply is matched to a contact by phone number, so in the rare case where two different SwiftCard users hold the same number and neither has texted them, an inbound reply can't be attributed and won't appear.",
  },
]);
