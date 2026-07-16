// ── Bot/crawler/link-unfurler detection for public analytics ingestion ──────
// Centralizes the User-Agent denylist so all three public ingest routes
// (views, card-events, analytics/event) apply the same rule — mirrors how
// self-traffic.ts centralizes owner exclusion. A missing User-Agent is NOT
// itself treated as a bot signal (some privacy-focused browsers/extensions
// strip it) — this only ever excludes a request that POSITIVELY matches a
// known bot/crawler/monitor signature, so a real visitor is never wrongly
// dropped for lacking data.
const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|slackbot|whatsapp|discordbot|telegrambot|twitterbot|bingpreview|linkedinbot|pinterest|redditbot|embedly|outbrain|vkshare|w3c_validator|headlesschrome|phantomjs|puppeteer|playwright|prerender|uptime|pingdom|lighthouse|semrush|ahrefsbot|mj12bot|dotbot|petalbot|bytespider/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA_PATTERN.test(userAgent);
}
