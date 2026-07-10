import { describe, it, expect } from "vitest";
import { socialUrl, normalizeSocial, handleLabel } from "@/lib/social-url";

describe("socialUrl", () => {
  it("passes a full URL through unchanged", () => {
    expect(socialUrl("instagram", "https://instagram.com/aaron")).toBe("https://instagram.com/aaron");
  });

  it("builds a profile URL from a bare handle per platform", () => {
    expect(socialUrl("instagram", "aaron")).toBe("https://instagram.com/aaron");
    expect(socialUrl("instagram", "@aaron")).toBe("https://instagram.com/aaron");
    expect(socialUrl("twitter", "aaron")).toBe("https://x.com/aaron");
    expect(socialUrl("tiktok", "aaron")).toBe("https://tiktok.com/@aaron");
    expect(socialUrl("snapchat", "aaron")).toBe("https://snapchat.com/add/aaron");
    expect(socialUrl("youtube", "aaron")).toBe("https://youtube.com/@aaron");
  });

  it("defaults a bare LinkedIn handle to /in/ but respects explicit prefixes", () => {
    expect(socialUrl("linkedin", "aaron")).toBe("https://linkedin.com/in/aaron");
    expect(socialUrl("linkedin", "company/malve")).toBe("https://linkedin.com/company/malve");
  });

  it("only treats a website value with a dot as a URL", () => {
    expect(socialUrl("website", "malvecapital.com")).toBe("https://malvecapital.com");
    expect(socialUrl("website", "not-a-domain")).toBeNull();
  });

  it("returns null for empty/nullish input", () => {
    expect(socialUrl("instagram", "")).toBeNull();
    expect(socialUrl("instagram", null)).toBeNull();
    expect(socialUrl("instagram", "   ")).toBeNull();
  });
});

describe("normalizeSocial", () => {
  it("reduces a handle-style network to @handle", () => {
    expect(normalizeSocial("https://instagram.com/aaron", "instagram")).toBe("@aaron");
    expect(normalizeSocial("aaron", "instagram")).toBe("@aaron");
    expect(normalizeSocial("@aaron", "instagram")).toBe("@aaron");
  });

  it("keeps the path for URL-style networks", () => {
    expect(normalizeSocial("https://linkedin.com/in/aaron", "linkedin")).toBe("linkedin.com/in/aaron");
    expect(normalizeSocial("https://youtube.com/@chan", "youtube")).toBe("youtube.com/@chan");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeSocial("   ", "instagram")).toBe("");
  });
});

describe("handleLabel", () => {
  it("strips the scheme for display", () => {
    expect(handleLabel("https://instagram.com/aaron")).toBe("instagram.com/aaron");
    expect(handleLabel(null)).toBe("");
  });
});
