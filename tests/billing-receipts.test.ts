import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { receiptEmail, trialStartedEmail } from "@/lib/email-templates";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const WEBHOOK = "src/app/api/stripe/webhook/route.ts";

describe("the receipt's invoice button goes somewhere the customer can reach", () => {
  it("never points at the merchant dashboard", () => {
    // dashboard.stripe.com is the MERCHANT console. Every receipt ever sent
    // carried that link, landing the customer on a login/permission wall.
    expect(code(WEBHOOK), "receipts link to the Stripe merchant dashboard").not.toMatch(
      /dashboard\.stripe\.com/,
    );
  });

  it("passes Stripe's customer-facing hosted invoice URL instead", () => {
    const c = code(WEBHOOK);
    expect(c).toMatch(/hosted_invoice_url/);
    expect(c).toMatch(/invoice_pdf/);
  });

  it("renders the button only when there is a URL to render", () => {
    const withUrl = receiptEmail({
      firstName: "Sam", email: "s@x.com", planName: "Pro", amount: "$4.99",
      interval: "Monthly", paymentDate: "January 1, 2027", invoiceNumber: "SC-1",
      invoiceUrl: "https://invoice.stripe.com/i/abc", manageUrl: "https://swiftcard.me/x",
    });
    expect(withUrl.html).toContain("https://invoice.stripe.com/i/abc");

    const without = receiptEmail({
      firstName: "Sam", email: "s@x.com", planName: "Pro", amount: "$4.99",
      interval: "Monthly", paymentDate: "January 1, 2027", invoiceNumber: "SC-1",
      manageUrl: "https://swiftcard.me/x",
    });
    expect(without.html).not.toContain("Download invoice PDF");
  });
});

describe("a $0.00 trial checkout does not get a payment receipt", () => {
  it("the trial email states the first charge date in its subject", () => {
    const t = trialStartedEmail({
      firstName: "Sam", planName: "Pro", amount: "$4.99", interval: "Monthly",
      firstChargeDate: "January 15, 2027", manageUrl: "https://swiftcard.me/x",
    });
    expect(t.subject).toContain("January 15, 2027");
    expect(t.subject, "still framed as a receipt").not.toMatch(/receipt/i);
  });

  it("says nothing was charged, and what will be", () => {
    const t = trialStartedEmail({
      firstName: "Sam", planName: "Pro", amount: "$4.99", interval: "Monthly",
      firstChargeDate: "January 15, 2027", manageUrl: "https://swiftcard.me/x",
    });
    expect(t.html).toMatch(/haven&#39;t been charged|haven't been charged/);
    expect(t.html).toContain("$0.00");
    expect(t.html).toContain("$4.99");
    expect(t.html, "no claim that a payment succeeded").not.toMatch(/processed successfully/);
  });

  it("the receipt template still asserts a payment — which is why the branch matters", () => {
    const r = receiptEmail({
      firstName: "Sam", email: "s@x.com", planName: "Pro", amount: "$0.00",
      interval: "Monthly", paymentDate: "January 1, 2027", invoiceNumber: "SC-1",
      manageUrl: "https://swiftcard.me/x",
    });
    expect(r.subject).toBe("Your SwiftCard receipt — $0.00");
    expect(r.html).toMatch(/processed successfully/);
  });

  it("the webhook branches on the trial and sends the recurring amount", () => {
    const c = code(WEBHOOK);
    expect(c).toMatch(/trialFirstChargeDate/);
    expect(c).toMatch(/sub\.trial_end/);
    // The trial email must quote what they WILL pay, not the $0.00 total.
    expect(c).toMatch(/recurringCents/);
  });
});

describe("annual renewals do not say Monthly", () => {
  it("reads the price id from pricing.price_details, not the retired top-level field", () => {
    const c = code(WEBHOOK);
    expect(c).toMatch(/pricing\?\.price_details\?\.price/);
    expect(c, "back on the field Stripe removed — every renewal reads as Monthly").not.toMatch(
      /lines\?: \{ data\?: Array<\{ price\?/,
    );
  });

  it("handles the id being expanded to a Price object rather than a string", () => {
    expect(code(WEBHOOK)).toMatch(/typeof priceDetail === "string"/);
  });
});
