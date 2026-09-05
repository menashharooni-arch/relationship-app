import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CRM_WEBHOOK_TIMEOUT_MS } from "@/lib/crm-events";

// Source pins, in the style of automation-hardening.test.ts: these guard the
// SHAPE of code whose failure mode is silent — a hang, not an error — which
// no unit test of the happy path would ever notice.
const read = (p: string) => readFileSync(p, "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("a CRM webhook can never hold the view pipeline open", () => {
  // dispatchCrmEvent is awaited inside recordView, between the card_views
  // insert and the milestone check, and again in /api/card-events before the
  // owner's push. Its try/catch swallows errors — but a webhook that never
  // answers is not an error, and it used to pin the request until the
  // platform killed it: the view was recorded, the notification never sent.
  it("dispatchCrmEvent bounds the Zapier fetch", () => {
    const src = stripComments(read("src/lib/crm-events.ts"));
    const fetchAt = src.indexOf("await fetch(p.zapier_webhook_url");
    expect(fetchAt, "the webhook fetch moved").toBeGreaterThan(-1);
    const call = src.slice(fetchAt, src.indexOf("});", fetchAt));
    expect(call).toMatch(/signal:\s*AbortSignal\.timeout\(CRM_WEBHOOK_TIMEOUT_MS\)/);
  });

  it("the lead-capture Zap gets the same bound", () => {
    // after() keeps the function alive until this settles, so an unanswering
    // webhook pinned an instance for the full platform limit per lead.
    const src = stripComments(read("src/app/api/leads/route.ts"));
    const fetchAt = src.indexOf("fetch(ownerProfile.zapier_webhook_url");
    expect(fetchAt, "the lead Zap fetch moved").toBeGreaterThan(-1);
    const call = src.slice(fetchAt, src.indexOf("}).catch", fetchAt));
    expect(call).toMatch(/signal:\s*AbortSignal\.timeout\(CRM_WEBHOOK_TIMEOUT_MS\)/);
  });

  it("the bound is short enough to sit inside a page request", () => {
    // A Zap catch hook answers in well under a second. Anything above ten
    // seconds is a hang wearing a timeout.
    expect(CRM_WEBHOOK_TIMEOUT_MS).toBeGreaterThan(0);
    expect(CRM_WEBHOOK_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });
});

describe("the Share button sends to a contact once, not once per tap", () => {
  // Production, 2026-08-11: three identical share-card texts to one person in
  // 31 seconds — a double (triple) tap, each one a real Twilio send. The route
  // had only a per-USER cap, which is for runaway clients, not thumbs.
  const src = stripComments(read("src/app/api/leads/share-card/route.ts"));

  it("rate-limits per (user, contact), not just per user", () => {
    expect(src).toMatch(/isRateLimited\(`share-card:\$\{user\.id\}:\$\{leadId\}`,\s*1,\s*SHARE_REPEAT_WINDOW_MS\)/);
  });

  it("checks it after leadId is known and before anything is sent", () => {
    const guard = src.indexOf("share-card:${user.id}:${leadId}");
    const leadCheck = src.indexOf('if (!leadId) return');
    const firstSend = Math.min(...["sendSms(", "sendRawEmail("].map((s) => src.indexOf(s)).filter((i) => i > -1));
    expect(guard).toBeGreaterThan(leadCheck);
    expect(guard).toBeLessThan(firstSend);
  });

  it("is a double-tap window, not a lockout", async () => {
    // Long enough to swallow a repeat tap, short enough that a deliberate
    // re-send a little later still works without support getting involved.
    const { SHARE_REPEAT_WINDOW_MS } = await import("@/app/api/leads/share-card/route");
    expect(SHARE_REPEAT_WINDOW_MS).toBeGreaterThanOrEqual(30_000);
    expect(SHARE_REPEAT_WINDOW_MS).toBeLessThanOrEqual(5 * 60_000);
  });
});

describe("a resumed sequence does not flood the contact", () => {
  const src = read("src/app/api/reminders/route.ts");

  it("tracks the channels already messaged on this run, per contact", () => {
    // Declared inside the per-lead body (after the working copy of the
    // sequence), so it resets for every contact and never leaks across them.
    const decl = src.indexOf("const sentThisRun = new Set<");
    const perLead = src.indexOf("let curSeq = seq;");
    const loop = src.indexOf("for (const item of seq) {");
    expect(decl).toBeGreaterThan(perLead);
    expect(decl).toBeLessThan(loop);
  });

  it("skips a second step on a channel already used this run — BEFORE claiming it", () => {
    // Ordering matters: a skipped step must stay unclaimed (sent_at null) so
    // tomorrow's run picks it up. Guard first, claim second.
    const guard = src.indexOf("if (sentThisRun.has(itemChannel)) continue;");
    const claim = src.indexOf("const claim = await stampStep(");
    expect(guard, "guard missing").toBeGreaterThan(-1);
    expect(guard).toBeLessThan(claim);
  });

  it("counts the channel at the claim, so a transient failure still holds the line", () => {
    // Marked once the claim is written and before delivery. If the send then
    // fails transiently the claim is released for a later run — but this
    // contact still gets no second message on that channel today.
    const mark = src.indexOf("sentThisRun.add(itemChannel);");
    const claim = src.indexOf("const claim = await stampStep(");
    const deliver = src.indexOf("const r = await deliverToLead({");
    expect(mark, "mark missing").toBeGreaterThan(claim);
    expect(mark).toBeLessThan(deliver);
  });

  it("the guard sits after every channel/consent check, so it never masks one", () => {
    // If the guard ran before the SMS consent check, an unconsented contact's
    // email step could be skipped because of an SMS step that was itself
    // never going to send. Consent and quiet-hours decide first.
    const guard = src.indexOf("if (sentThisRun.has(itemChannel)) continue;");
    const quiet = src.indexOf("if (!withinSmsQuietHours()) continue;");
    const emailPause = src.indexOf('} else if (channelPaused(seqLead.tags, "email"))');
    expect(guard).toBeGreaterThan(quiet);
    expect(guard).toBeGreaterThan(emailPause);
  });
});
