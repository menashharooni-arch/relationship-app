import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Push works on EVERY plan, and only for the five things worth interrupting ─
//
// Owner order 2026-09-06: "Make push notifications work for every account type
// and plan (free, paid, trial, office)… then make them high-signal, not spammy."
//
// Two contracts are guarded here and they pull in opposite directions, which is
// exactly why both need tests:
//
//   1. NO PLAN GATE. A Free account's first lead is the most important
//      notification SwiftCard will ever send. The plan is written to the log so
//      it can be audited; nothing branches on it. The per-plan cases below are
//      byte-identical apart from the plan string — that repetition IS the test.
//
//   2. A CLOSED LIST. Only new_lead, lead_reply, first_view, meeting_booked and
//      billing_problem may reach a phone, under a daily cap, inside quiet hours,
//      with copy that fits a lock screen.

type Row = Record<string, unknown>;

let profile: Row = { plan: "free", customization: {} };
let subscriptions: Row[] = [{ endpoint: "apns:tok-1", p256dh: "apns", auth: "apns" }];
let pushLog: Row[] = [];
const inserted: Row[] = [];
const apnsSent: Row[] = [];

vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabase: () => ({
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) };
      }
      if (table === "push_subscriptions") {
        return {
          select: () => ({ eq: async () => ({ data: subscriptions }) }),
          delete: () => ({ eq: async () => ({}) }),
        };
      }
      if (table === "push_log") {
        return {
          insert: async (row: Row) => { inserted.push(row); return {}; },
          select: () => ({ eq: () => ({ eq: () => ({ gte: async () => ({ data: pushLog }) }) }) }),
        };
      }
      throw new Error("unexpected table " + table);
    },
  }),
}));

vi.mock("@/lib/apns", () => ({
  isApnsEndpoint: (e: string) => e.startsWith("apns:"),
  sendApnsNotification: async (endpoint: string, payload: Row) => {
    apnsSent.push({ endpoint, ...payload });
    return "ok";
  },
}));

import { sendPushToUser } from "@/lib/push";
import { DAILY_CAP, MAX_BODY_CHARS, decidePush, fitBody, inQuietHours, readPushPrefs } from "@/lib/push-policy";

// 2pm UTC — comfortably outside quiet hours, so the plan cases test the plan
// and nothing else.
const MIDDAY = "2026-09-06T14:00:00.000Z";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(MIDDAY));
  profile = { plan: "free", customization: {} };
  subscriptions = [{ endpoint: "apns:tok-1", p256dh: "apns", auth: "apns" }];
  pushLog = [];
  inserted.length = 0;
  apnsSent.length = 0;
});

const last = () => inserted[inserted.length - 1];

async function sendLead() {
  await sendPushToUser("u1", {
    category: "new_lead",
    title: "New contact: Dana Whitfield",
    body: "Dana Whitfield shared their info with you.",
    url: "https://swiftcard.me/dashboard",
  });
}

describe("every plan gets the notification", () => {
  // The four account shapes the product actually sells. `trialing` is a real
  // stored value, not a synonym for pro — it was worth checking precisely
  // because a naive `plan === "pro"` gate would have excluded it.
  for (const plan of ["free", "pro", "trialing", "enterprise"]) {
    it(`delivers a new lead on the ${plan} plan`, async () => {
      profile = { plan, customization: {} };
      await sendLead();
      expect(apnsSent.length).toBe(1);
      expect(last()).toMatchObject({ category: "new_lead", plan, outcome: "sent" });
    });
  }

  it("records the plan on the log line without ever branching on it", async () => {
    // Same input, four plans, identical delivery — the log differs only in the
    // plan string it recorded.
    const outcomes: string[] = [];
    for (const plan of ["free", "pro", "trialing", "enterprise"]) {
      profile = { plan, customization: {} };
      apnsSent.length = 0;
      await sendLead();
      outcomes.push(`${apnsSent.length}:${(last() as Row).outcome}`);
    }
    expect(new Set(outcomes).size).toBe(1);
    expect(outcomes[0]).toBe("1:sent");
  });

  it("still sends when the log table does not exist yet", async () => {
    // Pre-migration production. Dropping every notification because a logging
    // table is missing would be a far worse failure than an uncapped day.
    pushLog = [];
    await sendLead();
    expect(apnsSent.length).toBe(1);
  });
});

describe("only the five allowed categories exist", () => {
  it("has no way to send an uncategorised push", () => {
    // Compile-time, so this is a documentation assertion: `category` is a
    // required field of a union type. If someone widens it to `string`, the
    // closed list stops being enforceable.
    const src = readFileSync(join(process.cwd(), "src/lib/push.ts"), "utf8");
    expect(src).toMatch(/category: PushCategory;/);
    expect(src).not.toMatch(/category\?:/);
  });

  it("stats, streaks and referral rewards no longer push", () => {
    for (const f of ["src/lib/milestones.ts", "src/lib/referral-server.ts"]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src).not.toMatch(/sendPushToUser/);
    }
  });
});

describe("a switched-off category", () => {
  it("is not sent, and says so in the log", async () => {
    profile = { plan: "pro", customization: { _push: { new_lead: false } } };
    await sendLead();
    expect(apnsSent.length).toBe(0);
    expect(last()).toMatchObject({ outcome: "category_off", plan: "pro" });
  });
});

describe("the daily cap", () => {
  it("stops the 6th capped push of the day", async () => {
    pushLog = Array.from({ length: DAILY_CAP }, () => ({ category: "first_view", created_at: MIDDAY }));
    profile = { plan: "free", customization: { _push: { first_view: true } } };
    await sendPushToUser("u1", {
      category: "meeting_booked", title: "Meeting booked", body: "Tue 3pm with Dana", url: "/x",
    });
    expect(apnsSent.length).toBe(0);
    expect(last()).toMatchObject({ outcome: "daily_cap" });
  });

  it("never applies to leads or billing", async () => {
    pushLog = Array.from({ length: 50 }, () => ({ category: "first_view", created_at: MIDDAY }));
    await sendLead();
    expect(apnsSent.length).toBe(1);
  });
});

describe("first views are batched to one an hour", () => {
  it("suppresses a second first-view inside the window", async () => {
    pushLog = [{ category: "first_view", created_at: "2026-09-06T13:30:00.000Z" }];
    await sendPushToUser("u1", {
      category: "first_view", title: "Your card was opened", body: "Someone in Austin opened your card", url: "/x",
    });
    expect(apnsSent.length).toBe(0);
    expect(last()).toMatchObject({ outcome: "batched" });
  });

  it("allows one an hour and a minute later", async () => {
    pushLog = [{ category: "first_view", created_at: "2026-09-06T12:55:00.000Z" }];
    await sendPushToUser("u1", {
      category: "first_view", title: "Your card was opened", body: "Someone in Austin opened your card", url: "/x",
    });
    expect(apnsSent.length).toBe(1);
  });
});

describe("quiet hours, 10pm to 8am local", () => {
  it("holds a lead at 11pm in the person's own timezone", async () => {
    // 06:00 UTC is 11pm the previous day in Los Angeles. A UTC-only check would
    // have called this "morning" and buzzed them.
    vi.setSystemTime(new Date("2026-09-06T06:00:00.000Z"));
    profile = { plan: "pro", customization: { _push: { timezone: "America/Los_Angeles" } } };
    await sendLead();
    expect(apnsSent.length).toBe(0);
    expect(last()).toMatchObject({ outcome: "quiet_hours" });
  });

  it("sends the same lead at 2pm local", async () => {
    vi.setSystemTime(new Date("2026-09-06T21:00:00.000Z")); // 2pm in LA
    profile = { plan: "pro", customization: { _push: { timezone: "America/Los_Angeles" } } };
    await sendLead();
    expect(apnsSent.length).toBe(1);
  });

  it("lets a billing problem through at 3am — and nothing else", async () => {
    vi.setSystemTime(new Date("2026-09-06T10:00:00.000Z")); // 3am in LA
    profile = { plan: "pro", customization: { _push: { timezone: "America/Los_Angeles" } } };
    await sendPushToUser("u1", {
      category: "billing_problem", title: "Payment failed", body: "Your Pro payment didn't go through.", url: "/x",
    });
    expect(apnsSent.length).toBe(1);
    await sendLead();
    expect(apnsSent.length).toBe(1);
  });
});

describe("the copy fits a lock screen", () => {
  it("trims the body on a word boundary, not mid-word", async () => {
    await sendPushToUser("u1", {
      category: "new_lead",
      title: "New contact",
      body: "Christopher Fairweather from Northbeam Commercial Real Estate Group shared their details with you just now",
      url: "/x",
    });
    const body = apnsSent[0].body as string;
    expect(body.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
    expect(body.endsWith("…")).toBe(true);
    expect(body).not.toMatch(/\s…$/);
  });

  it("leaves short copy alone", () => {
    expect(fitBody("Dana Whitfield replied")).toBe("Dana Whitfield replied");
  });
});

describe("the policy itself", () => {
  it("defaults every category on, with quiet hours on", () => {
    const prefs = readPushPrefs({});
    expect(prefs.new_lead).toBe(true);
    expect(prefs.quietHours).toBe(true);
  });

  it("treats an unknown timezone as UTC rather than throwing", () => {
    expect(() => inQuietHours(Date.parse(MIDDAY), "Mars/Olympus_Mons")).not.toThrow();
  });

  it("puts an explicit switch-off ahead of every other rule", () => {
    const verdict = decidePush({
      category: "billing_problem",
      prefs: { ...readPushPrefs({}), billing_problem: false },
      cappedSentToday: 0,
    });
    expect(verdict).toEqual({ send: false, reason: "category_off" });
  });
});
