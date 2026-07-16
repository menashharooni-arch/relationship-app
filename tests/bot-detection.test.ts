import { describe, it, expect } from "vitest";
import { isLikelyBot } from "@/lib/bot-detection";

describe("isLikelyBot", () => {
  it("flags well-known crawlers and link-unfurlers", () => {
    expect(isLikelyBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isLikelyBot("Slackbot-LinkExpanding 1.0")).toBe(true);
    expect(isLikelyBot("WhatsApp/2.23.20.0")).toBe(true);
    expect(isLikelyBot("facebookexternalhit/1.1")).toBe(true);
    expect(isLikelyBot("Twitterbot/1.0")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; DiscordBot/2.0; +https://discordapp.com)")).toBe(true);
  });

  it("flags headless/automation clients", () => {
    expect(isLikelyBot("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/119.0.0.0")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; PhantomJS)")).toBe(true);
  });

  it("does not flag a normal mobile or desktop browser", () => {
    expect(
      isLikelyBot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe(false);
    expect(
      isLikelyBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36")
    ).toBe(false);
  });

  it("never flags a missing User-Agent as a bot — fails open, not closed", () => {
    expect(isLikelyBot(null)).toBe(false);
    expect(isLikelyBot(undefined)).toBe(false);
    expect(isLikelyBot("")).toBe(false);
  });
});
