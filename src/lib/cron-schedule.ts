// ── When the daily send actually runs ────────────────────────────────────────
//
// One number, shared by the sender and by anything that TELLS a user when a
// message will go out. `/api/reminders` is a once-a-day cron (vercel.json,
// "0 18 * * *"): a follow-up step becomes due at an instant, but it is not
// delivered at that instant — it waits for the next run.
//
// The contact screen's "Sends <date>" used to format the due instant itself, in
// the reader's timezone, which named the wrong day whenever the local and UTC
// calendars disagreed at that moment. Anything answering "when will this send?"
// must reason about the RUN, not the due time, and that means knowing this
// hour. tests/cron-timing.test.ts pins it against vercel.json, so moving the
// schedule without moving this fails the suite rather than quietly making every
// scheduled date on the contact screen wrong.
export const CRON_HOUR_UTC = 18;
