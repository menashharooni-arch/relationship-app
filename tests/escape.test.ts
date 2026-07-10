import { describe, it, expect } from "vitest";
import { escapeHtml, safeUrlAttr } from "@/lib/escape";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x")&'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;"
    );
  });

  it("neutralizes an injected tag so it can't break out of a text node", () => {
    const out = escapeHtml("</p><img src=x onerror=alert(1)>");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("</p>");
    expect(out).toContain("&lt;img");
  });

  it("coerces null/undefined to an empty string, not the literal words", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeHtml("Aaron Lavi")).toBe("Aaron Lavi");
  });
});

describe("safeUrlAttr", () => {
  it("allows http(s), mailto, and tel", () => {
    expect(safeUrlAttr("https://swiftcard.me")).toBe("https://swiftcard.me");
    expect(safeUrlAttr("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeUrlAttr("tel:+15551234567")).toBe("tel:+15551234567");
  });

  it("blocks javascript: and data: URIs", () => {
    expect(safeUrlAttr("javascript:alert(1)")).toBe("#");
    expect(safeUrlAttr("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  it("rejects a scheme smuggled with whitespace or quotes", () => {
    expect(safeUrlAttr('https://x" onmouseover="alert(1)')).toBe("#");
    expect(safeUrlAttr("https://x\n.evil")).toBe("#");
  });

  it("returns # for a bare handle with no scheme", () => {
    expect(safeUrlAttr("swiftcard.me")).toBe("#");
    expect(safeUrlAttr("")).toBe("#");
    expect(safeUrlAttr(null)).toBe("#");
  });
});
