#!/usr/bin/env node
// App Store numbers in one place: ratings, written reviews, and downloads.
//
//   node scripts/appstore-stats.mjs
//   ASC_VENDOR_NUMBER=8xxxxxxx node scripts/appstore-stats.mjs        # adds downloads
//   ASC_VENDOR_NUMBER=8xxxxxxx node scripts/appstore-stats.mjs 30     # last 30 days
//
// THREE DIFFERENT SOURCES, because Apple splits them up:
//
//   ratings   — the public iTunes lookup endpoint. This is the lifetime star
//               average and rating COUNT shown on the store. The App Store
//               Connect API does not expose the aggregate anywhere.
//   reviews   — /v1/apps/{id}/customerReviews (needs the API key). Only reviews
//               with WRITTEN text appear here; a star-only rating never does,
//               which is why the counts differ.
//   downloads — /v1/salesReports, which needs the VENDOR NUMBER. Apple does not
//               expose that through the API: read it once from App Store Connect
//               → Payments and Financial Reports (top left, beside the legal
//               entity name) and keep it in ASC_VENDOR_NUMBER.
//
// The Analytics Reports API (app units, impressions, conversion) is the other
// route to downloads and this key is refused by it — that endpoint needs a key
// with the Analytics role.
import { gunzipSync } from "node:zlib";
import { asc, token, API, APP_ID } from "./lib/asc.mjs";

const DAYS = Number(process.argv[2] || 14);
const VENDOR = process.env.ASC_VENDOR_NUMBER;
const COUNTRY = (process.env.APP_STORE_COUNTRY || "us").toLowerCase();

const pad = (s, n) => String(s).padEnd(n);

// ── Ratings ─────────────────────────────────────────────────────────────────
try {
  const r = await fetch(`https://itunes.apple.com/lookup?id=${APP_ID}&country=${COUNTRY}`);
  const j = await r.json();
  const a = j.results?.[0];
  if (!a) {
    console.log("RATINGS      no store listing found (is the app live in this country?)");
  } else {
    const stars = Math.round(a.averageUserRating * 10) / 10;
    console.log(`RATINGS      ${stars} ★  from ${a.userRatingCount} rating(s)   [${a.trackName} v${a.version}]`);
    if (a.userRatingCountForCurrentVersion !== a.userRatingCount) {
      console.log(`             this version: ${Math.round(a.averageUserRatingForCurrentVersion * 10) / 10} ★ from ${a.userRatingCountForCurrentVersion}`);
    }
  }
} catch (e) {
  console.log("RATINGS      lookup failed:", e.message);
}

// ── Written reviews ─────────────────────────────────────────────────────────
try {
  const res = await asc("GET", `/apps/${APP_ID}/customerReviews?limit=50&sort=-createdDate`);
  const rows = res.data ?? [];
  console.log(`\nREVIEWS      ${rows.length} with written text`);
  for (const x of rows) {
    const a = x.attributes;
    console.log(`  ${"★".repeat(a.rating)}${"·".repeat(5 - a.rating)}  ${pad(a.createdDate?.slice(0, 10), 11)}${pad(a.territory, 5)}${a.reviewerNickname}`);
    if (a.title) console.log(`         “${a.title}”`);
    if (a.body) console.log(`         ${a.body.replace(/\s+/g, " ").slice(0, 160)}`);
  }
  if (!rows.length) console.log("  (star-only ratings never appear here — see the note at the top of this file)");
} catch (e) {
  console.log("\nREVIEWS      failed:", e.message.slice(0, 160));
}

// ── Downloads ───────────────────────────────────────────────────────────────
if (!VENDOR) {
  console.log("\nDOWNLOADS    set ASC_VENDOR_NUMBER to see these.");
  console.log("             App Store Connect → Payments and Financial Reports; the 8-digit");
  console.log("             number sits top-left next to the legal entity name.");
} else {
  // One report per day. Apple 404s a day with no data at all, which is normal
  // for a new app — that is not an error, it is a zero.
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const totals = { firstTime: 0, redownload: 0, update: 0, iap: 0 };
  const perDay = [];

  for (let i = 1; i <= DAYS; i++) {
    const date = day(i);
    const qs = new URLSearchParams({
      "filter[frequency]": "DAILY",
      "filter[reportType]": "SALES",
      "filter[reportSubType]": "SUMMARY",
      "filter[vendorNumber]": VENDOR,
      "filter[reportDate]": date,
    });
    let text = "";
    try {
      const res = await fetch(`${API}/salesReports?${qs}`, {
        headers: { Authorization: `Bearer ${token()}`, Accept: "application/a-gzip" },
      });
      if (res.status === 404) { perDay.push([date, 0, 0]); continue; }
      if (!res.ok) {
        const body = await res.text();
        console.log(`\nDOWNLOADS    ${date} → ${res.status}: ${body.replace(/\s+/g, " ").slice(0, 200)}`);
        if (res.status === 401 || res.status === 403) break;
        continue;
      }
      text = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
    } catch (e) {
      console.log(`\nDOWNLOADS    ${date} → ${e.message.slice(0, 120)}`);
      continue;
    }

    const [head, ...lines] = text.trim().split("\n");
    const cols = head.split("\t").map((c) => c.trim());
    const idx = (name) => cols.findIndex((c) => c.toLowerCase() === name.toLowerCase());
    const iType = idx("Product Type Identifier"), iUnits = idx("Units"), iApple = idx("Apple Identifier");

    let firstTime = 0, redownload = 0;
    for (const line of lines) {
      const f = line.split("\t");
      if (iApple >= 0 && f[iApple] && f[iApple].trim() !== String(APP_ID)) continue;
      const type = (f[iType] ?? "").trim();
      const units = Number(f[iUnits] ?? 0) || 0;
      // 1/1F/1T/1E/1EP/1EU = a first-time install; 3/3F… = a redownload;
      // 7/7F = an update; IA*/IAY/IAC = in-app purchase rows.
      if (/^1/.test(type)) { firstTime += units; totals.firstTime += units; }
      else if (/^3/.test(type)) { redownload += units; totals.redownload += units; }
      else if (/^7/.test(type)) totals.update += units;
      else if (/^IA/.test(type)) totals.iap += units;
    }
    perDay.push([date, firstTime, redownload]);
  }

  if (perDay.length) {
    console.log(`\nDOWNLOADS    last ${perDay.length} day(s)`);
    console.log(`  ${pad("date", 12)}${pad("new", 6)}re-download`);
    for (const [d, f, r] of perDay.reverse()) console.log(`  ${pad(d, 12)}${pad(f, 6)}${r}`);
    console.log(`  ${pad("TOTAL", 12)}${pad(totals.firstTime, 6)}${totals.redownload}`);
    if (totals.update) console.log(`  updates: ${totals.update}`);
    if (totals.iap) console.log(`  in-app purchase units: ${totals.iap}`);
  }
}
