import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Follow-up automations are Pro, and the app says so before they build one ──
//
// Owner, 2026-09-11: "make it so that only the pro account can do follow-up
// automations. The free account should not be able to set follow-up
// automations for email automation and text automation. There should be a pro
// badge on that, but it has to be a very small pro badge. I don't want it to be
// shoved in their face."
//
// The SENDER already refused: the daily cron pauses a sequence whose owner is
// not on a paid plan and writes them a bell row saying so. What was missing was
// anything stopping one from being SET UP — so a Free account could pick a
// cadence, submit it, and wait for messages that would never go out. That is
// the worst version of a plan limit: silent.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const contacts = read("src/components/ContactsClient.tsx");
const route = read("src/app/api/leads/[id]/route.ts");

describe("the app", () => {
  it("marks both channels PRO, and small", () => {
    // 0.5rem is the same tag the card finishes use — the smallest in the
    // product, and deliberately not a banner.
    expect(contacts).toMatch(/needsPro && <span className="text-\[0\.5rem\] font-bold text-blue-400 shrink-0">PRO<\/span>/);
    // One badge per channel card, and the cards are email + text.
    expect(contacts).toMatch(/ch: "email" as const, label: "Email"/);
    expect(contacts).toMatch(/ch: "sms" as const,\s+label: "Text"/);
  });

  it("explains only when they tap the switch — nothing pops up uninvited", () => {
    const onClick = contacts.slice(contacts.indexOf("if (needsPro) {"), contacts.indexOf("if (isDrafting) cancelDraft()"));
    expect(onClick).toMatch(/setAiUpgrade\(/);
    expect(onClick).toMatch(/return;/);
    // The explanation is one sentence about what the feature does.
    expect(contacts).toMatch(/Follow-up automations are part of Pro/);
  });

  it("never blocks switching an existing automation OFF", () => {
    // A downgraded account has to be able to stop what it already has. The
    // badge and the gate apply only where nothing is set up yet.
    expect(contacts).toMatch(/const needsPro = !isPro && !hasActive;/);
    const onClick = contacts.slice(contacts.indexOf("if (!can) return;"), contacts.indexOf("if (needsPro) {"));
    expect(onClick).toMatch(/if \(running\) \{ toggleChannelPause\(ch\); return; \}/);
  });

  it("takes the plan from the server, not from a guess in the browser", () => {
    expect(read("src/app/contacts/page.tsx")).toMatch(/isPro=\{paid\}/);
    expect(contacts).toMatch(/isPro = false,/);
  });
});

describe("the server", () => {
  it("refuses to store a new sequence for a Free account", () => {
    const block = route.slice(route.indexOf('if ("follow_up_sequence" in body)'), route.indexOf("// `tags` is server-owned"));
    expect(block).toMatch(/isPaidPlan\(prof\?\.plan as string \| null\)/);
    expect(block).toMatch(/status: 402/);
    expect(block).toMatch(/code: "PRO_REQUIRED"/);
  });

  it("still lets anyone CLEAR one", () => {
    const block = route.slice(route.indexOf('if ("follow_up_sequence" in body)'), route.indexOf("// `tags` is server-owned"));
    // Only a non-empty sequence is gated: [] and null go straight through, which
    // is what Reset ↺ and the dissolve path send.
    expect(block).toMatch(/const adding = Array\.isArray\(next\) \? next\.length > 0 : next != null;/);
    expect(block).toMatch(/if \(adding\) \{/);
  });

  it("and the sender still pauses anything already running on a Free account", () => {
    // The rule that was already right, pinned so it stays: this is what makes
    // the gate above a plan limit rather than a way to strand a downgraded
    // account's live sequences.
    const reminders = read("src/app/api/reminders/route.ts");
    expect(reminders).toMatch(/if \(!isPaidPlan\(owner\.profile\.plan\)\) \{/);
    expect(reminders).toMatch(/type: "sequence_paused"/);
    expect(reminders).toMatch(/nothing was deleted/i);
  });
});
