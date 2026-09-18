import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PUSH_ASK_GAP_MS, PUSH_ASK_MAX, PUSH_ASK_MAX_AGE_MS, PUSH_ASK_TYPES,
  decidePushAsk, laterPushAsk, pickAskCandidate, pushAskCopy, pushAskQuietUntil, readPushAsk, snoozePushAsk, stopPushAsk,
} from "@/lib/push-ask";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

// ── "Get notifications like this on your phone" ─────────────────────────────
//
// Owner, 2026-09-18: when someone who skipped the notifications switch gets an
// important notification, the bell should offer push right there. But "not on
// all their notifications, because it's going to be too spammy. After reminding
// them a few times, if they really don't want push notifications on, they
// don't want it on." These pin exactly that.

const NOW = Date.parse("2026-09-18T15:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const row = (id: string, type: string, agoMs: number, read = false) =>
  ({ id, type, read, created_at: new Date(NOW - agoMs).toISOString() });

describe("which notification may carry the reminder", () => {
  it("only a new contact, a reply or a contact download — never a view or anything else", () => {
    expect([...PUSH_ASK_TYPES].sort()).toEqual(["contact_saved", "lead_reply", "new_lead"]);
    for (const t of ["card_viewed", "milestone_25", "signature_stale", "pro_ended", "payment_failed", "referral_claim"]) {
      expect(pickAskCandidate([row("a", t, 1000)], NOW)).toBeNull();
    }
  });

  it("ONE row: the newest unread important one", () => {
    const rows = [
      row("old-lead", "new_lead", 3 * 60_000),
      row("view", "card_viewed", 60_000),
      row("new-reply", "lead_reply", 2 * 60_000),
      row("read-save", "contact_saved", 30_000, true),
    ];
    expect(pickAskCandidate(rows, NOW)).toBe("new-reply");
  });

  it("nothing already read, and nothing older than two weeks", () => {
    expect(pickAskCandidate([row("a", "new_lead", 1000, true)], NOW)).toBeNull();
    expect(pickAskCandidate([row("a", "new_lead", PUSH_ASK_MAX_AGE_MS + 1000)], NOW)).toBeNull();
    expect(pickAskCandidate([row("a", "new_lead", PUSH_ASK_MAX_AGE_MS - 1000)], NOW)).toBe("a");
  });
});

describe("a few reminders, then never again", () => {
  const empty = readPushAsk(undefined);

  it("the first important notification gets a reminder, and it is recorded", () => {
    const d = decidePushAsk(empty, "lead-1", NOW);
    expect(d.show).toBe(true);
    expect(d.next).toEqual({ n: 1, at: new Date(NOW).toISOString(), id: "lead-1", later: false, stop: false });
  });

  it("the SAME notification is one reminder however often the bell is opened", () => {
    const after = decidePushAsk(empty, "lead-1", NOW).next!;
    const again = decidePushAsk(after, "lead-1", NOW + 60_000);
    expect(again).toEqual({ show: true, next: null }); // shows, counts nothing
  });

  it("'Not now' puts it away for good", () => {
    const shown = decidePushAsk(empty, "lead-1", NOW).next!;
    const later = laterPushAsk(shown, "lead-1")!;
    expect(decidePushAsk(later, "lead-1", NOW + 1000).show).toBe(false);
    // …and only the reminder actually showing can be put away.
    expect(laterPushAsk(shown, "some-other-id")).toBeNull();
  });

  it(`a second reminder waits at least ${PUSH_ASK_GAP_MS / DAY} days — three leads in an afternoon are ONE reminder`, () => {
    const first = laterPushAsk(decidePushAsk(empty, "lead-1", NOW).next!, "lead-1")!;
    expect(decidePushAsk(first, "lead-2", NOW + 2 * 60 * 60_000).show).toBe(false);
    expect(decidePushAsk(first, "lead-2", NOW + PUSH_ASK_GAP_MS - 1000).show).toBe(false);
    const second = decidePushAsk(first, "lead-2", NOW + PUSH_ASK_GAP_MS + 1000);
    expect(second.show).toBe(true);
    expect(second.next!.n).toBe(2);
  });

  it(`never more than ${PUSH_ASK_MAX} for the account, however long it has been`, () => {
    let ledger = readPushAsk(undefined);
    let t = NOW;
    for (let i = 1; i <= PUSH_ASK_MAX; i++) {
      const d = decidePushAsk(ledger, `lead-${i}`, t);
      expect(d.show).toBe(true);
      ledger = laterPushAsk(d.next!, `lead-${i}`)!;
      t += PUSH_ASK_GAP_MS + DAY;
    }
    expect(decidePushAsk(ledger, "lead-99", t + 365 * DAY).show).toBe(false);
  });

  it("'Don't ask again' ends it, including the reminder that is showing", () => {
    const shown = decidePushAsk(empty, "lead-1", NOW).next!;
    const stopped = stopPushAsk(shown)!;
    expect(decidePushAsk(stopped, "lead-1", NOW).show).toBe(false);
    expect(decidePushAsk(stopped, "lead-2", NOW + 30 * DAY).show).toBe(false);
    expect(stopPushAsk(stopped)).toBeNull(); // nothing to write twice
  });

  it("'Not now' on the dashboard box rests the reminders too — no second ask seconds later", () => {
    const pending = decidePushAsk(empty, "lead-1", NOW).next!;
    const rested = snoozePushAsk(pending, NOW + 60_000)!;
    expect(decidePushAsk(rested, "lead-1", NOW + 120_000).show).toBe(false); // the pending one retires
    expect(decidePushAsk(rested, "lead-2", NOW + 120_000).show).toBe(false); // and the gap restarts
    expect(pushAskQuietUntil(rested)).toBe(NOW + 60_000 + PUSH_ASK_GAP_MS);
    // A box "Not now" is not a reminder: it does not spend the budget.
    expect(rested.n).toBe(1);
  });

  it("reads anything stored — or nothing, or junk — as a sane ledger", () => {
    expect(readPushAsk(null)).toEqual({ n: 0, at: null, id: null, later: false, stop: false });
    expect(readPushAsk({ n: "7", stop: "yes", later: 1 })).toEqual({ n: 0, at: null, id: null, later: false, stop: false });
    expect(readPushAsk({ n: 2.9, stop: true })).toMatchObject({ n: 2, stop: true });
  });

  it("says phone on a phone and computer on a computer", () => {
    expect(pushAskCopy(true).title).toBe("Get notifications like this on your phone");
    expect(pushAskCopy(false).title).toBe("Get notifications like this on this computer");
    for (const c of [pushAskCopy(true), pushAskCopy(false)]) {
      expect(`${c.title} ${c.sub}`).not.toMatch(/pro|upgrade|\$|free trial/i); // never a sales line
    }
  });
});

describe("the server is the authority", () => {
  const route = read("src/app/api/push/ask/route.ts");

  it("never asks an account that already gets pushes on any device", () => {
    expect(route).toMatch(/if \(await accountHasPush\(user\.id\)\) return NextResponse\.json\(\{ show: false \}\);/);
    // A failed count reads as "on" — never as a reason to nag.
    expect(route).toMatch(/if \(error\) return true;/);
  });

  it("checks the notification is theirs, unread, recent and important before spending anything", () => {
    expect(route).toMatch(/\.eq\("id", id\)\s*\n\s*\.eq\("user_id", user\.id\)/);
    expect(route).toMatch(/!row \|\| row\.read \|\| !isAskableType\(row\.type as string\) \|\| !\(age <= PUSH_ASK_MAX_AGE_MS\)/);
  });

  it("decides inside the verified read-modify-write, and an unrecorded ask is not shown", () => {
    expect(route).toMatch(/mutateCustomization<unknown>\(user\.id, PUSH_ASK_KEY, \(cur\) => \{\s*\n\s*const d = decidePushAsk\(readPushAsk\(cur\), id\);/);
    expect(route).toMatch(/if \(!r\.ok\) return NextResponse\.json\(\{ show: false \}\);/);
  });
});

describe("one ask on screen, and every way of saying no is honoured", () => {
  it("the box outranks the list, the list outranks the bell", () => {
    expect(read("src/lib/push-ask-client.ts")).toMatch(/const RANK: Record<AskSurface, number> = \{ nudge: 3, panel: 2, bell: 1 \};/);
    expect(read("src/components/PushNudge.tsx")).toMatch(/useAskSlot\("nudge", visible\);/);
    expect(read("src/components/NotificationsPanel.tsx")).toMatch(/usePushAsk\("panel", askId, true\)/);
    // The bell counts a reminder only when its dropdown is actually open.
    expect(read("src/components/NotificationBell.tsx")).toMatch(/usePushAsk\("bell", askId, open\)/);
  });

  it("only where this device can switch push on in one tap", () => {
    expect(read("src/components/PushAskCallout.tsx")).toMatch(/const askable = state === "idle" && !askStopped\(\) && !askPushOn\(\) && !askSnoozed\(\) && decision !== false;/);
  });

  it("a 'Don't Allow' at the device's own prompt ends it — from ANY switch; a denial already in place does not fire", () => {
    const btn = read("src/components/EnablePushButton.tsx");
    expect(btn).toMatch(/if \(state === "working"\) \{ askedHere\.current = true; return; \}/);
    expect(btn).toMatch(/if \(state === "denied" && askedHere\.current\) \{\s*\n\s*askedHere\.current = false;\s*\n\s*stopAsk\(\);/);
  });

  it("switching push OFF on purpose ends it — sign-out does not", () => {
    const btn = read("src/components/EnablePushButton.tsx");
    expect((btn.match(/turnedOffOnPurpose\(\);/g) ?? []).length).toBe(2); // native + web
    expect(read("src/lib/push-device.ts")).not.toMatch(/stopAsk|push\/ask/);
  });

  it("turning push on anywhere retires every ask on screen", () => {
    expect(read("src/components/EnablePushButton.tsx")).toMatch(/if \(ok\) \{ setForcedOff\(false\); onDone\?\.\(\); notePushOn\(\); \}/);
  });

  it("the dashboard box respects the account too, and 'Not now' there rests the reminders", () => {
    const nudge = read("src/components/PushNudge.tsx");
    expect(nudge).toMatch(/setAccount\(j\.pushOn \|\| j\.stopped \|\| quiet \? "done" : "ask"\)/);
    expect(nudge).toMatch(/onClick=\{\(\) => \{ dismiss\(\); snoozeAsk\(\); \}\}/);
    // Turning push on from the box is not a "Not now".
    expect(nudge).toContain("<EnablePushButton onDone={dismiss} />");
  });

  it("the list's reminder is a sibling of the row, so a tap on the switch can never open the contact", () => {
    const panel = read("src/components/NotificationsPanel.tsx");
    const rowEnd = panel.indexOf("{n.id === askId && <PushAskCallout");
    const clickable = panel.lastIndexOf("onClick={CONTACT_TYPES.has(n.type)", rowEnd);
    const closeRow = panel.lastIndexOf("</div>", rowEnd);
    expect(rowEnd).toBeGreaterThan(-1);
    expect(clickable).toBeGreaterThan(-1);
    expect(closeRow).toBeGreaterThan(clickable); // the row is closed before the reminder
  });
});
