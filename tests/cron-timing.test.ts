import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withinSmsQuietHours, maxDuration } from "@/app/api/reminders/route";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const at = (utcHour: number) => new Date(Date.UTC(2027, 0, 15, utcHour, 30, 0));

describe("automated SMS stays inside the recipient's waking hours", () => {
  it("refuses the hour the cron used to fire at", () => {
    // 13:00 UTC was 06:00 PDT / 05:00 PST / 03:00 HST.
    expect(withinSmsQuietHours(at(13))).toBe(false);
  });

  it("allows the new cron slot", () => {
    // 18:00 UTC = 08:00 HST / 11:00 PDT / 14:00 EDT.
    expect(withinSmsQuietHours(at(18))).toBe(true);
  });

  it("the whole allowed window is 8am-9pm across every US zone we serve", () => {
    // Hawaii (UTC-10) is the earliest: 8am local = 18:00 UTC.
    // Eastern (UTC-4, EDT) is the latest: 9pm local = 01:00 UTC next day.
    for (const h of [18, 19, 20, 21, 22, 23, 0]) {
      expect(withinSmsQuietHours(at(h)), `${h}:00 UTC should be allowed`).toBe(true);
    }
    for (const h of [1, 5, 8, 12, 13, 15, 17]) {
      expect(withinSmsQuietHours(at(h)), `${h}:00 UTC should be refused`).toBe(false);
    }
  });

  it("is wired into the SMS branch, not the email one", () => {
    const c = code("src/app/api/reminders/route.ts");
    expect(c).toMatch(/if \(!withinSmsQuietHours\(\)\) continue;/);
    const smsBranchAt = c.indexOf('if (itemChannel === "sms")');
    const guardAt = c.indexOf("if (!withinSmsQuietHours()) continue;");
    expect(guardAt).toBeGreaterThan(smsBranchAt);
    // Email carries its own unsubscribe and is not subject to quiet hours.
    const emailBranchAt = c.indexOf('} else if (channelPaused(seqLead.tags, "email"))');
    expect(guardAt).toBeLessThan(emailBranchAt);
  });

  it("the cron schedule matches the guard", () => {
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
    const cron = vercel.crons.find((c: { path: string }) => c.path === "/api/reminders");
    expect(cron.schedule).toBe("0 18 * * *");
    const hour = Number(cron.schedule.split(" ")[1]);
    expect(withinSmsQuietHours(at(hour)), "the cron fires at an hour SMS is refused").toBe(true);
  });
});

describe("the cron can't be silently truncated", () => {
  it("declares an explicit maxDuration", () => {
    // Five sequential jobs in one request, ending with a send loop over up to
    // 50,000 rows. With no maxDuration the tail was dropped: no error, no
    // alert, no retry.
    expect(maxDuration).toBe(300);
  });
});

describe("the contact screen doesn't promise a time the sender can't keep", () => {
  it("shows a date, not a clock time", () => {
    const c = code("src/components/ContactsClient.tsx");
    expect(c).toMatch(/function sendWhen\(createdAt: string, day: number\)/);
    expect(c).toMatch(/toLocaleDateString\("en-US", \{ month: "short", day: "numeric" \}\)/);
  });

  it("no longer reads the step time the sender ignores", () => {
    const c = code("src/components/ContactsClient.tsx");
    expect(c, "still renders it.time as a promised send time").not.toMatch(
      /sendWhen\([^)]*it\.time/,
    );
  });
});
