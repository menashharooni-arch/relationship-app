import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── The automation invariants that are easy to regress and silent when broken ─
//
// Every rule here was a live bug. None of them threw, logged, or failed a test —
// they just quietly sent a message twice, dropped a notification, or told
// someone they were unsubscribed when they were not. Source scans because the
// property is structural (ordering, presence of a guard) and there is no way to
// exercise a serverless freeze or a mid-run crash from a unit test.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("the follow-up sender cannot send the same message twice", () => {
  const src = read("src/app/api/reminders/route.ts");

  it("claims the step BEFORE delivering it", () => {
    // The old order was deliver-then-stamp across two un-transacted steps, so a
    // timeout (300s ceiling, up to 50k leads), a transient DB failure or an
    // overlapping manual run left the message delivered and the step unstamped
    // — and the next run sent the identical AI-written message again.
    const claim = src.indexOf("const claim = await stampStep(");
    const deliver = src.indexOf("const r = await deliverToLead({");
    expect(claim, "claim call missing").toBeGreaterThan(-1);
    expect(deliver, "deliver call missing").toBeGreaterThan(-1);
    expect(claim, "the claim must come first — that is the entire fix").toBeLessThan(deliver);
  });

  it("refuses to send when the claim could not be written", () => {
    // A message we cannot record is one we will send again tomorrow.
    expect(src).toMatch(/if \(!claim\.ok\) \{[\s\S]{0,120}continue;/);
  });

  it("checks the write error instead of discarding it", () => {
    // The update's `error` used to be dropped, so a failed write meant the mail
    // went out and the row still said unsent — a permanent daily re-send.
    const stamp = src.slice(src.indexOf("async function stampStep"));
    expect(stamp).toMatch(/error:\s*writeErr/);
    expect(stamp).toMatch(/if \(writeErr\) return \{ ok: false/);
  });

  it("re-reads the sequence before stamping, so a concurrent edit is not clobbered", () => {
    // The old write pushed a whole-array snapshot taken minutes earlier, which
    // could resurrect steps the owner had just deleted.
    const stamp = src.slice(src.indexOf("async function stampStep"));
    expect(stamp).toMatch(/\.select\("follow_up_sequence"\)/);
    expect(stamp, "a step the owner removed must not be re-added").toMatch(/if \(!fresh\.some/);
  });

  it("releases the claim only on a TRANSIENT failure", () => {
    // opted_out / no_contact are final: re-trying them forever would be its own
    // bug. Anything else is released so a later run retries.
    expect(src).toMatch(/r\.status !== "opted_out" && r\.status !== "no_contact"/);
    expect(src).toMatch(/stampStep\(supabase, seqLead\.id as string, item, null\)/);
  });

  it("reports a failed send instead of retrying it silently forever", () => {
    expect(src).toMatch(/reminders\.sequences\.send-failed/);
  });
});

describe("the cadence stops for contacts the owner has written off", () => {
  const src = read("src/app/api/reminders/route.ts");

  it("excludes not_interested as well as dissolved", () => {
    expect(src).toMatch(/status\.neq\.not_interested/);
  });

  it("keeps a NULL-status lead eligible", () => {
    // `status <> 'x'` is NULL, not true, for a NULL status — a plain .neq()
    // would silently drop every lead whose status was never set, which is most
    // of them on the public capture path.
    expect(src).toMatch(/status\.is\.null/);
  });
});

describe("a captured lead always reaches the owner", () => {
  const src = read("src/app/api/leads/route.ts");

  it("runs the notification and push inside after()", () => {
    // Bare floating promises can be frozen off when the serverless function
    // returns — the lead saves and the owner is simply never told. The CRM
    // syncs in the same file were fixed for this; these two were missed.
    const notify = src.indexOf("insertNotification({");
    const push = src.indexOf("sendPushToUser(");
    for (const [name, i] of [["notification", notify], ["push", push]] as const) {
      const before = src.slice(Math.max(0, i - 200), i);
      expect(before, `${name} is not wrapped in after()`).toMatch(/after\(\s*$/m);
    }
  });

  it("reports side-effect failures rather than swallowing them", () => {
    expect(src).toMatch(/reportError\("leads\.notify"/);
    expect(src).toMatch(/reportError\("leads\.push"/);
    // Zapier was the one integration with no error surface at all.
    expect(src).toMatch(/reportError\("leads\.zapier"/);
  });

  it("gives the after() work room to finish", () => {
    // Four CRM providers (two making two sequential calls) plus a webhook.
    expect(src).toMatch(/export const maxDuration = \d+/);
  });
});

describe("an opt-out is never confirmed unless it was recorded", () => {
  it("addOptOut reports whether it landed", () => {
    const src = read("src/lib/messaging.ts");
    expect(src).toMatch(/export async function addOptOut\([^)]*\): Promise<boolean>/s);
    // It used to swallow BOTH a throw and PostgREST's non-throwing { error }.
    expect(src).toMatch(/if \(!error\) return true;/);
  });

  it("the unsubscribe page does not claim success on a failed write", () => {
    const src = read("src/app/api/unsubscribe/contact/route.ts");
    expect(src).toMatch(/if \(!\(await addOptOut\("email", email\)\)\)/);
    // RFC 8058 one-click must return non-2xx so the mail client can retry.
    expect(src).toMatch(/status: 500/);
  });

  it("a STOP text that fails to record is reported", () => {
    const src = read("src/app/api/twilio/inbound/route.ts");
    expect(src).toMatch(/if \(!\(await addOptOut\("sms", from\)\)\)/);
    expect(src).toMatch(/stop-not-recorded/);
  });
});

describe("a saved text automation is actually sendable", () => {
  it("surfaces a failure to grant sms-ok", () => {
    // The cron hard-requires sms-ok. That request's result was discarded, so a
    // failure left a sequence the UI showed as running that could never send.
    const src = read("src/components/ContactsClient.tsx");
    expect(src).toMatch(/tagsOk = await updateTags/);
    expect(src).toMatch(/if \(!tagsOk\)/);
  });
});
