import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { receiptEmail, trialStartedEmail, paymentFailedEmail, trialChargeSoonEmail } from "@/lib/email-templates";

// ── Office admin: sign-up → checkout → setup → dashboard tour ────────────────
// Pins what the 2026-09-22 end-to-end review of the Office-admin journey found.
// Each block names the defect it exists to stop coming back.

const code = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const U = "https://swiftcard.me/settings/flows?billing=1";

describe("after paying, a new Office owner lands on THEIR dashboard", () => {
  it("the /welcome setup step never routes Office into the admin console", () => {
    // Owner, 2026-09-22: never straight into /office/admin. checkout/success and
    // the wizard were fixed in c4302b96; this step still sent Office there.
    const w = code("src/components/WelcomePlan.tsx");
    expect(w).not.toMatch(/"\/office\/admin"/);
    expect(w).toMatch(/setupFor \? LANDING \+ "&upgraded=true"/);
    expect(w).not.toContain("Go to my Office dashboard");
  });

  it("the ?upgraded banner and its event name Office for an Office buyer", () => {
    const d = code("src/app/dashboard/page.tsx");
    expect(d).toMatch(/props=\{\{ plan: isEnterprise \? "office" : "pro" \}\}/);
    expect(d).toContain("Welcome to Office!");
  });
});

describe("leaving Stripe keeps the Office selection", () => {
  it("both cancel URLs carry plan, interval, seats and promo", () => {
    const r = code("src/app/api/stripe/checkout/route.ts");
    expect(r).toMatch(/const selection = `plan=\$\{planKey\}&interval=\$\{interval\}\$\{isOffice \? `&seats=\$\{quantity\}` : ""\}/);
    expect(r).toContain("`/welcome?${selection}&canceled=1`");
    expect(r).toContain("`/checkout?${selection}&canceled=1`");
    expect(r).not.toContain('"/welcome?canceled=1"');
  });
});

describe("the login page only speaks of an invitation to someone invited", () => {
  it("'accept your invitation' is reserved for /join links", () => {
    const l = code("src/app/login/page.tsx");
    expect(l).toMatch(/next\?\.startsWith\("\/join\/"\)\s*\n?\s*\? initialMode === "signup"/);
    expect(l).not.toMatch(/\{next\s*\n\s*\? "Sign in to accept your invitation\."/);
  });
});

describe("billing email quotes the whole Office bill", () => {
  it("trial amounts are unit price × quantity, in both places they are stored", () => {
    const w = code("src/app/api/stripe/webhook/route.ts");
    expect(w).toContain("item.price.unit_amount * (item.quantity ?? 1)");
    expect(w).toContain("trialPrice.unit_amount * (trialItem?.quantity ?? 1)");
    expect(w).not.toMatch(/recurringCents = sub\.items\?\.data\?\.\[0\]\?\.price\?\.unit_amount \?\? null/);
  });

  it("the payment-failed email says Office, never Enterprise", () => {
    const w = code("src/app/api/stripe/webhook/route.ts");
    expect(w).toContain('const planName = profile.plan === "enterprise" ? "Office" : "Pro";');
  });

  it("receipts show the seats, and never greet 'there'", () => {
    const r = receiptEmail({ firstName: "", email: "a@b.co", planName: "Office", amount: "$19.95", interval: "Monthly", paymentDate: "Sep 22, 2026", invoiceNumber: "SC-1", manageUrl: U, seats: 5 });
    expect(r.html).toContain("5 (incl. you)");
    expect(r.html).toContain("Thank you. Your payment");
    expect(r.html).not.toContain("there.");
    const named = receiptEmail({ firstName: "Dana", email: "a@b.co", planName: "Pro", amount: "$4.99", interval: "Monthly", paymentDate: "x", invoiceNumber: "SC-1", manageUrl: U });
    expect(named.html).toContain("Thank you, Dana.");
    expect(named.html).not.toContain("Seats");
    const t = trialStartedEmail({ firstName: "", planName: "Office", amount: "$19.95", interval: "Monthly", firstChargeDate: "Oct 6, 2026", manageUrl: U, seats: 5 });
    expect(t.html).toContain("You're all set. You haven't been charged");
    expect(t.html).toContain("5 (incl. you)");
  });

  it("the payment-failed email promises a grace week only when one exists", () => {
    const grace = paymentFailedEmail({ firstName: "Dana", planName: "Office", amount: "$19.95", manageUrl: U, situation: "grace" });
    expect(grace.html).toContain("You have 7 days");
    const retry = paymentFailedEmail({ firstName: "Dana", planName: "Office", amount: "$19.95", manageUrl: U, situation: "retry" });
    expect(retry.html).not.toContain("7 days");
    const ended = paymentFailedEmail({ firstName: "", planName: "Office", amount: "$19.95", manageUrl: U, situation: "trial_ended" });
    expect(ended.html).not.toContain("7 days");
    expect(ended.html).toContain("your teammates move to Free too");
    expect(ended.subject).toContain("has ended");
    // The email is sent AFTER the never-paid decision, not before it.
    const w = code("src/app/api/stripe/webhook/route.ts");
    const handler = w.slice(w.indexOf('event.type === "invoice.payment_failed"'));
    expect(handler.indexOf('await sendFailed("trial_ended")')).toBeLessThan(handler.indexOf("subscriptions.cancel(invoiceSubId)"));
  });

  it("the 7-day Office trial notice says the team moves to Free", () => {
    const o = trialChargeSoonEmail({ firstName: "Dana", planName: "Office", chargeDate: "Oct 6, 2026", amountCents: 1995, intervalWord: "monthly", manageUrl: U });
    expect(o.html).toContain("Your team's seats end");
    expect(o.html).toContain("$19.95 monthly");
    const p = trialChargeSoonEmail({ firstName: "Dana", planName: "Pro", chargeDate: "Oct 6, 2026", manageUrl: U });
    expect(p.html).not.toContain("Your team's seats end");
  });
});

describe("the sample contact is never a team lead", () => {
  // Every new card gets "Jordan Rivera" (lib/demo-contact, tagged demo). The
  // office side counted it: a pre-ticked "Capture your first lead", "1 team
  // lead is waiting" pushed to a brand-new owner, and a teammate's real first
  // lead counting 2 so the first-lead alert never fired.
  const files: [string, number][] = [
    ["src/lib/office-analytics.ts", 3],
    ["src/lib/office-leads.ts", 2],
    ["src/lib/office-team.ts", 2],
    ["src/lib/team-alerts.ts", 1],
    ["src/app/api/push/recap/route.ts", 4],
  ];
  for (const [f, n] of files) {
    it(`${f} excludes it from every leads query`, () => {
      const c = code(f);
      const queries = c.split('from("leads")').length - 1;
      const excluded = c.split('.not("tags", "cs", "{demo}")').length - 1;
      expect(queries).toBe(n);
      expect(excluded).toBe(n);
    });
  }
});

describe("the rest of the journey", () => {
  it("the builder's save gate doesn't promise a plan choice already made", () => {
    const g = code("src/components/GuestGateModal.tsx");
    expect(g).toMatch(/\[\?&\]plan=\(office\|pro\)/);
    expect(g).toContain("Next you&apos;ll check out for {pickedPlan}");
  });

  it("a paused main tour ignores the keyboard (the admin tour owns it)", () => {
    expect(code("src/components/GuidedTour.tsx")).toContain("if (!running || paused) return;");
  });

  it("a failed plan write makes the webhook fail, so Stripe retries", () => {
    const w = code("src/app/api/stripe/webhook/route.ts");
    expect(w).toContain("const { error: planWriteError } = await admin.from(\"profiles\").update({");
    expect(w).toContain("if (planWriteError) throw new Error(");
  });
});

describe("a granted Office ends for the whole team", () => {
  it("grant expiry releases the team, like a cancelled subscription", () => {
    const r = code("src/lib/referral-server.ts");
    const fn = r.slice(r.indexOf("export async function expireFreeMonths"));
    expect(fn).toMatch(/if \(u\.plan === "enterprise"\) \{\s*await tearDownOfficeForOwner\(admin, u\.id as string\)/);
    // only after the conditional downgrade actually wrote (paid rows skipped)
    expect(fn.indexOf("tearDownOfficeForOwner")).toBeGreaterThan(fn.indexOf("if (!(wrote ?? []).length) continue;"));
  });
});
