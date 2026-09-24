// ── Create account at 390px: three boxes, one width, nothing spilling ───────
//
// The signup form gained a second password box and a strength meter. A source
// scan can confirm they exist; only a layout can confirm they fit. Rendered
// with the app's real CSS at iPhone width inside the /login card wrapper.

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { appCss } from "./harness";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

const IPHONE = { width: 390, height: 844 };

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

async function renderLogin(props: { initialMode: "signin" | "signup"; redirectTo?: string }) {
  const { default: LoginForm } = await import("@/components/LoginForm");
  return renderToStaticMarkup(createElement(LoginForm, props));
}

async function renderField(value: string) {
  const { default: PasswordField } = await import("@/components/PasswordField");
  const { assessPassword } = await import("@/lib/password-policy");
  return renderToStaticMarkup(
    createElement(PasswordField, {
      id: "p", name: "password", label: "Password", autoComplete: "new-password",
      value, onChange: () => {}, strength: assessPassword(value), error: "Passwords don't match.",
    }),
  );
}

async function page(inner: string) {
  const css = await appCss();
  const p = await browser.newPage({ viewport: IPHONE, hasTouch: true, isMobile: true });
  await p.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>` +
      `<body><main class="min-h-screen bg-cream flex items-center justify-center px-5"><div class="w-full max-w-sm">` +
      `<div id="card" class="bg-warm-card border border-warm-card-border rounded-2xl p-6 shadow-sm">${inner}</div></div></main></body></html>`,
    { waitUntil: "load" },
  );
  return p;
}

describe("create account at phone width", () => {
  it("email, password and confirm share one width and none leaves the card", async () => {
    const p = await page(await renderLogin({ initialMode: "signup", redirectTo: "/cards/new?claim=1" }));
    try {
      const m = await p.evaluate(() => {
        const card = document.getElementById("card")!.getBoundingClientRect();
        const box = (id: string) => document.getElementById(id)!.getBoundingClientRect();
        return {
          card: { left: card.left, right: card.right },
          email: box("auth-email"), password: box("auth-password"), confirm: box("auth-confirm-password"),
          scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
        };
      });
      expect(m.scrollW, "no sideways page scroll").toBeLessThanOrEqual(m.innerW);
      for (const k of ["email", "password", "confirm"] as const) {
        expect(m[k].width, k).toBeCloseTo(m.email.width, 0);
        expect(m[k].left, k).toBeGreaterThanOrEqual(m.card.left);
        expect(m[k].right, k).toBeLessThanOrEqual(m.card.right);
      }
    } finally { await p.close(); }
  });

  it("sign in has no confirm box at all", async () => {
    const html = await renderLogin({ initialMode: "signin" });
    expect(html).not.toContain("auth-confirm-password");
    expect(html).toContain('id="auth-password"');
  });

  it("the meter, the eye and the error all have room under a filled box", async () => {
    const p = await page(await renderField("Abc12345"));
    try {
      const m = await p.evaluate(() => {
        const input = document.getElementById("p")!;
        const ir = input.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(input).paddingRight);
        const eye = document.querySelector<HTMLElement>('button[aria-label="Show password"]')!.getBoundingClientRect();
        const segs = Array.from(document.querySelectorAll<HTMLElement>("[data-segment]")).map((s) => s.getBoundingClientRect());
        const err = document.getElementById("p-error")!.getBoundingClientRect();
        return { textRight: ir.right - pad, eyeLeft: eye.left, eyeInside: eye.right <= ir.right + 0.5 && eye.top >= ir.top - 0.5, segs, err, inputBottom: ir.bottom };
      });
      expect(m.eyeInside, "eye sits inside the box").toBe(true);
      expect(m.textRight, "eye does not cover the typed text").toBeLessThanOrEqual(m.eyeLeft + 0.5);
      expect(m.segs.length).toBe(3);
      for (const s of m.segs) { expect(s.height).toBeGreaterThan(0); expect(s.width).toBeGreaterThan(20); }
      expect(m.err.top).toBeGreaterThan(m.inputBottom);
      expect(m.err.height).toBeGreaterThan(0);
    } finally { await p.close(); }
  });
});
