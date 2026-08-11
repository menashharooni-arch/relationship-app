import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Replying to a contact ────────────────────────────────────────────────────
//
// The Activity & Messages panel rendered a CONVERSATION with no way to take
// part in it: you could read what a contact sent and had no reply box.
// POST /api/leads/[id]/message could always send — email preferred, SMS when
// the contact opted in — and nothing in the app had ever called it.
//
// The route is the authority on what may be sent. The UI's job is to never
// offer a send the route will refuse, and to repeat the route's own sentence
// when it does refuse, because those sentences say what to do next
// ("this contact opted out of texts") where a generic failure does not.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const ui = () => read("src/components/ContactsClient.tsx");
const route = () => read("src/app/api/leads/[id]/message/route.ts");

describe("the reply box is wired to the send endpoint", () => {
  it("POSTs to the message route", () => {
    const src = ui();
    expect(src).toMatch(/fetch\(`\/api\/leads\/\$\{selected\.id\}\/message`, \{\s*method: "POST"/s);
  });

  it("sends the chosen channel with the text", () => {
    expect(ui()).toMatch(/body: JSON\.stringify\(\{ text: body, channel: replyChannel \}\)/);
  });

  it("appends the message the SERVER recorded, not an optimistic guess", () => {
    // The route can send on a different channel than requested (email when SMS
    // is unavailable), so echoing our own assumption would show the thread a
    // channel the message did not go out on.
    expect(ui()).toMatch(/if \(data\.message\) setConvoMessages\(\(prev\) => \[\.\.\.prev, data\.message\]\)/);
  });

  it("guards against double-send", () => {
    expect(ui()).toMatch(/if \(!selected \|\| replySending\) return;/);
  });
});

describe("it never offers a send the server will refuse", () => {
  it("only offers Text when the contact has a phone AND has not declined", () => {
    // The route rejects a declined contact with 409 sms_declined. Offering the
    // button anyway would be a control whose only outcome is an error.
    const src = ui();
    expect(src).toMatch(/const smsDeclined = \(selected\.tags \?\? \[\]\)\.includes\("sms-paused"\)/);
    expect(src).toMatch(/const canSms = !!selected\.phone && !smsDeclined/);
  });

  it("only offers Email when the contact has one", () => {
    expect(ui()).toMatch(/const canEmail = !!selected\.email/);
  });

  it("says so plainly when neither channel is available", () => {
    // Better than a disabled box with no explanation.
    expect(ui()).toMatch(/No email or phone on file/);
  });

  it("falls back to the available channel rather than sending on a dead one", () => {
    // Picking Text, then switching to a contact with no phone, must not leave
    // "sms" selected and post it.
    expect(ui()).toMatch(/replyChannel === "sms" && !canSms \? "email"/);
  });
});

describe("failures say what happened", () => {
  it("surfaces the route's own message", () => {
    expect(ui()).toMatch(/setReplyError\(data\.message \|\| data\.error/);
  });

  it("the route distinguishes the cases worth distinguishing", () => {
    // Each of these needs a different action from the user, so collapsing them
    // into one error would lose the instruction.
    const r = route();
    expect(r).toMatch(/"sms_declined"/);
    expect(r).toMatch(/"opted_out"/);
    expect(r).toMatch(/"not_configured"/);
    expect(r).toMatch(/status: 429/); // rate limited — real spend guard
  });

  it("clears the error as soon as the user edits the message", () => {
    // A stale error sitting under a rewritten message reads as still-broken.
    expect(ui()).toMatch(/if \(replyError\) setReplyError\(null\)/);
  });
});

describe("sending stays inside the guards the route already has", () => {
  it("respects the route's length cap in the input", () => {
    // The route 413s over 5000; the textarea stops you there rather than
    // letting you write a long message and lose it to an error.
    expect(ui()).toMatch(/maxLength=\{5000\}/);
    expect(route()).toMatch(/body\.length > 5000/);
  });

  it("the route still checks ownership before sending", () => {
    expect(route()).toMatch(/ownsLead\(usernames, lead\)/);
  });
});
