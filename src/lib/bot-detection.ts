// ── Bot/crawler/link-unfurler detection for public analytics ingestion ──────
// Centralizes the User-Agent denylist so all three public ingest routes
// (views, card-events, analytics/event) apply the same rule — mirrors how
// self-traffic.ts centralizes owner exclusion. A missing User-Agent is NOT
// itself treated as a bot signal (some privacy-focused browsers/extensions
// strip it) — this only ever excludes a request that POSITIVELY matches a
// known bot/crawler/monitor signature, so a real visitor is never wrongly
// dropped for lacking data.
//
// FOUR FAMILIES, now named rather than blended into one alternation. The
// decision they feed is unchanged — isLikelyBot still tests the union of
// exactly these tokens — but a recorded event can now say WHICH family fired,
// which is the difference between "something was excluded" and an answerable
// question about whether the classifier is right.

/** Search engines, social unfurlers, messaging previews, AI crawlers.
 *
 *  NOT the bare words "instagram", "snapchat" or "pinterest". Those appear in
 *  the IN-APP BROWSER of each app ("… Instagram 312.0.0.34.111 (iPhone…)",
 *  "… Snapchat/12.95 …", "… Pinterest for iOS/…") — a real person who tapped
 *  the link in a bio, i.e. the exact visitor a card exists for — and matching
 *  them silently dropped every one of those views. Each company's actual
 *  preview crawler is still caught: Pinterest's by "pinterest/0." and
 *  "pinterestbot", Snap's by "snap url preview" (and its "bot;" token), and
 *  Instagram's previews come from facebookexternalhit / meta-externalagent. */
const CRAWLER =
  "bot|crawl|spider|slurp|facebookexternalhit|slackbot|whatsapp|discordbot|telegrambot|twitterbot|bingpreview|linkedinbot|pinterestbot|pinterest\\/0\\.|redditbot|embedly|outbrain|vkshare|semrush|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|skypeuripreview|google-inspectiontool|googleother|meta-externalagent|facebookcatalog|barkrowler|iframely|snap url preview|applebot|amazonbot|claudebot|anthropic|gptbot|oai-searchbot|chatgpt-user|perplexitybot|youbot|cohere|ccbot|diffbot|dataforseo|serpapi|screaming frog|google-read-aloud|googleimageproxy|duckduckbot|yandex";

/** Headless browsers and render farms — they execute JS, so only the UA shows. */
const AUTOMATION = "headlesschrome|phantomjs|puppeteer|playwright|prerender|lighthouse|w3c_validator";

/** Synthetic uptime/monitoring and platform screenshotters. */
const MONITOR =
  "uptime|pingdom|datadog|newrelic|checkly|statuscake|site24x7|betteruptime|vercel-screenshot|vercel-favicon";

/** Bare HTTP clients. A scripted POST is never a person standing at a card. */
const HTTP_CLIENT =
  "curl\\/|wget\\/|python-requests|python-urllib|python-httpx|aiohttp|axios\\/|node-fetch|undici|go-http-client|okhttp|java\\/|libwww-perl|scrapy|httpie|insomnia|postmanruntime";

const FAMILIES = [
  ["crawler", CRAWLER],
  ["automation", AUTOMATION],
  ["monitor", MONITOR],
  ["http_client", HTTP_CLIENT],
] as const;

export type BotFamily = (typeof FAMILIES)[number][0];

/** The union — byte-equivalent in effect to the single pattern this replaced. */
const BOT_UA_PATTERN = new RegExp(FAMILIES.map(([, p]) => p).join("|"), "i");

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA_PATTERN.test(userAgent);
}

/**
 * WHICH family matched, for the ingest decision log. Null for anything that
 * isn't a positive match — including a missing User-Agent, which is not
 * evidence of anything.
 *
 * Deliberately returns the family NAME and never the User-Agent string itself:
 * a UA is a device fingerprint, and the log exists to explain decisions, not to
 * profile visitors.
 */
export function botFamily(userAgent: string | null | undefined): BotFamily | null {
  if (!userAgent) return null;
  for (const [name, pattern] of FAMILIES) {
    if (new RegExp(pattern, "i").test(userAgent)) return name;
  }
  return null;
}
