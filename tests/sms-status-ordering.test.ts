import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── A delivery failure must not be un-reported by a straggling callback ──────
//
// Found in production on 2026-08-11. Three shared-card texts were rejected by
// the carrier with Twilio error 30034 (A2P 10DLC number not registered). The
// failures were logged correctly. All three rows still read "queued", and the
// contact thread showed "Queued" for texts that were never going to arrive.
//
// Twilio sends one INDEPENDENT HTTP POST per transition — queued, sent,
// undelivered — and independent requests arrive in whatever order the network
// gives them. The callback wrote every status unconditionally, so a "queued"
// that landed after "undelivered" reset the row.
//
// The rule: a terminal status always wins; a non-terminal status may only land
// on a row that has not already reached a terminal state.

const root = process.cwd();
const route = () => readFileSync(join(root, "src/app/api/twilio/status/route.ts"), "utf8");

describe("terminal delivery statuses are final", () => {
  it("knows which statuses a message cannot move out of", () => {
    const src = route();
    expect(src).toMatch(/const TERMINAL = \["delivered", "undelivered", "failed", "canceled"\]/);
  });

  it("guards the write when the incoming status is NOT terminal", () => {
    expect(route()).toMatch(/if \(!TERMINAL\.includes\(status\)\) \{/);
  });

  it("applies a terminal status unconditionally", () => {
    // The guard is only added inside the !terminal branch, so delivered /
    // undelivered / failed always overwrite whatever is there.
    const src = route();
    const guardBlock = src.match(/if \(!TERMINAL\.includes\(status\)\) \{[\s\S]*?\n    \}/)?.[0] ?? "";
    expect(guardBlock).toMatch(/q = q\.or\(/);
    // The base update must be built BEFORE the branch, not inside it.
    expect(src).toMatch(/let q = admin\s*\n\s*\.from\("lead_messages"\)/);
  });

  it("includes the null arm, without which the FIRST callback never applies", () => {
    // PostgREST: `status.neq.failed` is NULL — not true — for a row whose
    // status IS NULL. A freshly inserted message has status NULL, so omitting
    // this arm would silently drop every message's first status update.
    // Verified against real PostgREST: with the arm, the first "queued"
    // callback matched 1 row; the later straggler matched 0.
    expect(route()).toMatch(/status\.is\.null,and\(\$\{TERMINAL\.map/);
  });

  it("still reports a terminal failure to ops", () => {
    // 30034 means the whole sending number is unregistered, so EVERY text is
    // failing — this is the signal that says so.
    expect(route()).toMatch(/TERMINAL_FAILURES\.has\(status\) && \(updated\?\.length \?\? 0\) > 0/);
    expect(route()).toMatch(/"sms\.delivery-failed"/);
  });

  it("always answers 200 so Twilio does not retry forever", () => {
    expect(route()).toMatch(/Always 200/);
  });
});

describe("the thread does not claim delivery Twilio never confirmed", () => {
  it("treats Twilio's own status as authoritative over our optimistic one", () => {
    // sendSms returns "sent" on API ACCEPTANCE. That is not delivery, and the
    // callback is what corrects it.
    const ui = readFileSync(join(root, "src/components/ContactsClient.tsx"), "utf8");
    expect(ui).toMatch(/case "queued":/);
    expect(ui).toMatch(/outDeliveryLabel/);
  });
});
