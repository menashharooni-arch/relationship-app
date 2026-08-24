// Create the App Store subscription products for the IAP remedy (3.1.1):
// subscription group "SwiftCard Pro" with monthly + annual auto-renewables,
// US pricing matched to the web ($4.99/mo, ~$54/yr), and a 14-day free-trial
// introductory offer on each. Mirrors lib/iap-shared.ts identifiers.
//
//   node scripts/asc-iap-setup.mjs           # show current IAP state
//   node scripts/asc-iap-setup.mjs --create  # create anything missing
//
// Idempotent: safe to re-run; existing pieces are reported and kept.
// Creates products only — it never submits anything for review.
import { asc, APP_ID } from "./lib/asc.mjs";

const GROUP_NAME = "SwiftCard Pro";
const PRODUCTS = [
  { productId: "me.swiftcard.app.pro.monthly", name: "Pro Monthly", period: "ONE_MONTH", usdTarget: 4.99 },
  { productId: "me.swiftcard.app.pro.annual", name: "Pro Annual", period: "ONE_YEAR", usdTarget: 53.99 },
];

const create = process.argv.includes("--create");

// ── Group ──
const groups = await asc("GET", `/apps/${APP_ID}/subscriptionGroups?limit=10`);
let group = (groups.data || []).find((g) => g.attributes.referenceName === GROUP_NAME) ?? null;
console.log(group ? `group exists: ${group.id}` : "group: missing");
if (!group && create) {
  const made = await asc("POST", "/subscriptionGroups", {
    data: {
      type: "subscriptionGroups",
      attributes: { referenceName: GROUP_NAME },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  group = made.data;
  console.log("group created:", group.id);
}
if (group && create) {
  const locs = await asc("GET", `/subscriptionGroups/${group.id}/subscriptionGroupLocalizations`);
  if (!(locs.data || []).some((l) => l.attributes.locale === "en-US")) {
    await asc("POST", "/subscriptionGroupLocalizations", {
      data: {
        type: "subscriptionGroupLocalizations",
        attributes: { name: "SwiftCard Pro", locale: "en-US" },
        relationships: { subscriptionGroup: { data: { type: "subscriptionGroups", id: group.id } } },
      },
    }).then(() => console.log("group localization created"))
      .catch((e) => console.log("group localization:", String(e).slice(0, 200)));
  }
}
if (!group) process.exit(0);

// ── Subscriptions ──
const subs = await asc("GET", `/subscriptionGroups/${group.id}/subscriptions?limit=20`);
for (const spec of PRODUCTS) {
  let sub = (subs.data || []).find((s) => s.attributes.productId === spec.productId) ?? null;
  console.log(`\n${spec.productId}: ${sub ? `exists (${sub.attributes.state})` : "missing"}`);
  if (!sub && create) {
    const made = await asc("POST", "/subscriptions", {
      data: {
        type: "subscriptions",
        attributes: {
          name: spec.name,
          productId: spec.productId,
          subscriptionPeriod: spec.period,
          groupLevel: 1,
          reviewNote:
            "Unlocks SwiftCard Pro on the account signed into the app. The same subscription is sold on the web via Stripe; per 3.1.3(b) it is offered here via In-App Purchase as well, and a purchase on either platform unlocks the other.",
        },
        relationships: { group: { data: { type: "subscriptionGroups", id: group.id } } },
      },
    });
    sub = made.data;
    console.log("  created:", sub.id);
  }
  if (!sub) continue;

  if (create) {
    // Localization
    const locs = await asc("GET", `/subscriptions/${sub.id}/subscriptionLocalizations`).catch(() => ({ data: [] }));
    if (!(locs.data || []).some((l) => l.attributes.locale === "en-US")) {
      await asc("POST", "/subscriptionLocalizations", {
        data: {
          type: "subscriptionLocalizations",
          attributes: {
            name: spec.name,
            locale: "en-US",
            description: "Everything in SwiftCard, unlimited.",
          },
          relationships: { subscription: { data: { type: "subscriptions", id: sub.id } } },
        },
      }).then(() => console.log("  localization created"))
        .catch((e) => console.log("  localization:", String(e).slice(0, 160)));
    }

    // Price: pick the USA price point closest to the target.
    const prices = await asc("GET", `/subscriptions/${sub.id}/prices?limit=5&include=subscriptionPricePoint`).catch(() => ({ data: [] }));
    if ((prices.data || []).length === 0) {
      const points = await asc(
        "GET",
        `/subscriptions/${sub.id}/pricePoints?filter[territory]=USA&limit=200`,
      );
      const best = (points.data || [])
        .map((p) => ({ id: p.id, price: parseFloat(p.attributes.customerPrice) }))
        .sort((a, b) => Math.abs(a.price - spec.usdTarget) - Math.abs(b.price - spec.usdTarget))[0];
      if (!best) { console.log("  no USA price points returned"); continue; }
      await asc("POST", "/subscriptionPrices", {
        data: {
          type: "subscriptionPrices",
          relationships: {
            subscription: { data: { type: "subscriptions", id: sub.id } },
            subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: best.id } },
            territory: { data: { type: "territories", id: "USA" } },
          },
        },
      }).then(() => console.log(`  price set: $${best.price}`))
        .catch((e) => console.log("  price:", String(e).slice(0, 200)));
    } else {
      console.log("  price already set");
    }

    // 14-day free trial introductory offer (matches the web's trial promise).
    const intros = await asc("GET", `/subscriptions/${sub.id}/introductoryOffers?limit=5`).catch(() => ({ data: [] }));
    if ((intros.data || []).length === 0) {
      await asc("POST", "/subscriptionIntroductoryOffers", {
        data: {
          type: "subscriptionIntroductoryOffers",
          attributes: { duration: "TWO_WEEKS", offerMode: "FREE_TRIAL", numberOfPeriods: 1 },
          relationships: {
            subscription: { data: { type: "subscriptions", id: sub.id } },
            territory: { data: { type: "territories", id: "USA" } },
          },
        },
      }).then(() => console.log("  14-day free trial created"))
        .catch((e) => console.log("  intro offer:", String(e).slice(0, 200)));
    } else {
      console.log("  intro offer already set");
    }

    // Availability: US only, matching the app.
    await asc("POST", "/subscriptionAvailabilities", {
      data: {
        type: "subscriptionAvailabilities",
        attributes: { availableInNewTerritories: false },
        relationships: {
          subscription: { data: { type: "subscriptions", id: sub.id } },
          availableTerritories: { data: [{ type: "territories", id: "USA" }] },
        },
      },
    }).then(() => console.log("  availability: USA"))
      .catch((e) => console.log("  availability:", String(e).slice(0, 160)));
  }
}
console.log("\nDone. Nothing was submitted for review.");
