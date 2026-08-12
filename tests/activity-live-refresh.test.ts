import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Activity & Messages has to describe the present ──────────────────────────
//
// Reported from the field: sharing your card by email from a contact appeared
// to do nothing. The message WAS sent and WAS logged — but the panel had loaded
// once, in selectLead, and was never read again. You had to leave the contact
// and come back to see the line. A successful send that looks like a no-op is
// worse than a visible failure: the user's next move is to send it again.
//
// The fix is one refresh function every action calls, rather than each action
// hand-patching its own row into state — that is what let the share path drift
// from the reply path in the first place. These tests pin the wiring, and the
// two things that make it safe: the staleness guard and the failure behaviour.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const ui = () => read("src/components/ContactsClient.tsx");

describe("one refresh both feeds behind the panel", () => {
  it("re-reads the message thread", () => {
    expect(ui()).toMatch(/async function refreshActivity\(\)/);
    const fn = ui().match(/async function refreshActivity\(\)[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(fn).toMatch(/fetch\(`\/api\/leads\/\$\{lead\.id\}\/message`\)/);
  });

  it("re-reads the contact's card events too", () => {
    // The panel merges BOTH sources. Refreshing only messages would leave a
    // card scan or vCard save just as invisible as the email was.
    //
    // Asked for by LEAD, not by visitor id: three share surfaces never stored
    // a visitor id, so keying the request on one meant those contacts asked
    // for nothing and showed an empty conversation forever. The route resolves
    // the lead and matches its visitor id AND its email/phone.
    const fn = ui().match(/async function refreshActivity\(\)[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(fn).toMatch(/fetch\(`\/api\/card-events\?lead_id=\$\{encodeURIComponent\(lead\.id\)\}`\)/);
  });
});

describe("every action that writes to the panel refreshes it", () => {
  it("sharing your card", () => {
    // The reported bug. The button reports success from the route, and the
    // route logs before it answers, so the row exists by the time this runs.
    expect(ui()).toMatch(/onSent=\{refreshActivity\}/);
    const btn = read("src/components/ShareMyInfoButton.tsx");
    expect(btn).toMatch(/onSent\?\.\(\)/);
  });

  it("only after a send the SERVER accepted", () => {
    // Refreshing on a failed send would fetch a thread nothing was added to,
    // and refreshing the phone-share path would fetch for a send that is
    // deliberately never logged.
    const btn = read("src/components/ShareMyInfoButton.tsx");
    const okBranch = btn.match(/if \(res\.ok\) \{[\s\S]*?\n      \} else \{/)?.[0] ?? "";
    expect(okBranch).toMatch(/onSent\?\.\(\)/);
    const phoneShare = btn.match(/async function sharePhone\(\)[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(phoneShare).not.toMatch(/onSent/);
  });

});

describe("the panel stays read-only", () => {
  // Messaging a contact happens through AUTOMATIONS, plus the Share button's
  // one-time card send. There is deliberately NO free-text compose box: a reply
  // box was added here once, was never a feature of this product, and was
  // removed. The panel is a log of what happened, not a chat client.
  const src = () => ui();

  it("has no compose field", () => {
    expect(src()).not.toMatch(/<textarea[\s\S]{0,400}?placeholder=\{`Write a /);
    expect(src()).not.toMatch(/setReplyText|replyChannel|sendReply/);
  });

  it("nothing in the app POSTs a hand-written message", () => {
    // The route's POST still exists and is owner-gated, but no UI calls it —
    // the state this product has always been in. Reading the thread is a GET.
    const posts = src().match(/fetch\(`\/api\/leads\/\$\{[^`]*\}\/message`, \{\s*method: "POST"/g);
    expect(posts).toBeNull();
  });

  it("still labels itself as auto-tracked and read-only", () => {
    expect(src()).toMatch(/Auto-tracked · read-only/);
  });
});

describe("activity that arrives on its own", () => {
  it("re-reads when the app returns to the foreground", () => {
    // Inbound replies, scheduler follow-ups and revised delivery statuses are
    // written while nobody is looking at this tab.
    const src = ui();
    expect(src).toMatch(/document\.addEventListener\("visibilitychange", onVisible\)/);
    expect(src).toMatch(/document\.visibilityState === "visible"/);
  });

  it("removes the listener when the contact changes", () => {
    expect(ui()).toMatch(/document\.removeEventListener\("visibilitychange", onVisible\)/);
  });

  it("does not poll", () => {
    // A timer would fetch forever for every open contact to catch something
    // that arrives rarely.
    const fn = ui().match(/const refreshRef = useRef[\s\S]*?\}, \[selected\?\.id\]\);/)?.[0] ?? "";
    expect(fn).not.toMatch(/setInterval/);
  });
});

describe("the refresh cannot corrupt what is on screen", () => {
  it("discards a response for a contact the user already left", () => {
    // Same guard selectLead uses. Without it, a slow refresh for contact A
    // lands in contact B's panel.
    const fn = ui().match(/async function refreshActivity\(\)[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(fn).toMatch(/const seq = selectSeq\.current;/);
    expect(fn).toMatch(/if \(selectSeq\.current === seq && Array\.isArray\(d\.messages\)\) setConvoMessages\(d\.messages\)/);
    expect(fn).toMatch(/if \(selectSeq\.current === seq && Array\.isArray\(data\)\) setEvents\(data\)/);
  });

  it("keeps the displayed log when a refresh fails", () => {
    // selectLead clears to [] because it is SWITCHING contacts and the old
    // thread is wrong. Here the log on screen is still correct, and a dropped
    // request is no reason to blank out real history.
    const fn = ui().match(/async function refreshActivity\(\)[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(fn).not.toMatch(/setConvoMessages\(\[\]\)/);
    expect(fn).not.toMatch(/setEvents\(\[\]\)/);
  });

  it("still ignores a malformed payload", () => {
    // Array.isArray gates both writes, so a route returning an error object
    // cannot put a non-array into state and crash the render.
    const fn = ui().match(/async function refreshActivity\(\)[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(fn).toMatch(/Array\.isArray\(d\.messages\)/);
    expect(fn).toMatch(/Array\.isArray\(data\)/);
  });
});
