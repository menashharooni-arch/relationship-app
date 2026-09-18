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

  // Warm-lead plan H6: the in-app browsers are PEOPLE who tapped a bio link.
  it("does not flag the Instagram, Snapchat or Pinterest in-app browsers", () => {
    expect(
      isLikelyBot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 312.0.0.34.111 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 548339486)"
      )
    ).toBe(false);
    expect(
      isLikelyBot(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.40.92 Android"
      )
    ).toBe(false);
    expect(
      isLikelyBot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.95.0.40 (like Safari/8617.2.4.10.8, panda)"
      )
    ).toBe(false);
    expect(
      isLikelyBot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [Pinterest/iOS]"
      )
    ).toBe(false);
  });

  it("still flags those companies' own preview crawlers", () => {
    expect(isLikelyBot("Pinterest/0.2 (+https://www.pinterest.com/bot.html)")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; Snap URL Preview Service; bot; snapchat; https://developers.snap.com/robots)")).toBe(true);
    expect(isLikelyBot("meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)")).toBe(true);
  });

  it("never flags a missing User-Agent as a bot — fails open, not closed", () => {
    expect(isLikelyBot(null)).toBe(false);
    expect(isLikelyBot(undefined)).toBe(false);
    expect(isLikelyBot("")).toBe(false);
  });
});
