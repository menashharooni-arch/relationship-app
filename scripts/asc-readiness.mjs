// node scripts/asc-readiness.mjs
//
// READ-ONLY. What stands between the current App Store version and a Submit
// button: its state, the build attached to it, the release notes, screenshots,
// review contact, export compliance, and the age rating / privacy-policy
// fields Apple blocks submission on. Writes nothing.
import { asc, APP_ID } from "./lib/asc.mjs";

const line = (k, v) => console.log(`  ${String(k).padEnd(26)} ${v}`);

const vers = await asc("GET", `/apps/${APP_ID}/appStoreVersions?limit=3&fields[appStoreVersions]=versionString,appStoreState,platform,releaseType,createdDate,earliestReleaseDate,downloadable`);
const v = (vers.data ?? []).find((x) => x.attributes.appStoreState !== "READY_FOR_SALE") ?? vers.data?.[0];
if (!v) { console.log("no versions"); process.exit(0); }

console.log(`\nVERSION ${v.attributes.versionString}  (${v.attributes.appStoreState})  id ${v.id}`);
line("platform", v.attributes.platform);
line("release type", v.attributes.releaseType);

// ── The build ──
try {
  const b = await asc("GET", `/appStoreVersions/${v.id}/build?fields[builds]=version,uploadedDate,processingState,expired`);
  line("build attached", b.data ? `${b.data.attributes.version} (${b.data.attributes.processingState}, uploaded ${String(b.data.attributes.uploadedDate).slice(0, 10)})` : "NONE");
} catch { line("build attached", "NONE — nothing selected"); }

// ── Release notes / what's new ──
try {
  const loc = await asc("GET", `/appStoreVersions/${v.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,whatsNew,description,keywords,promotionalText`);
  for (const l of loc.data ?? []) {
    const a = l.attributes;
    line(`locale ${a.locale}`, `whatsNew: ${a.whatsNew ? `"${a.whatsNew.slice(0, 70).replace(/\n/g, " ")}"` : "EMPTY"}`);
    line("", `id ${l.id}`);
    // Screenshots hang off the localization.
    try {
      const sets = await asc("GET", `/appStoreVersionLocalizations/${l.id}/appScreenshotSets?limit=20&fields[appScreenshotSets]=screenshotDisplayType`);
      const names = [];
      for (const s of sets.data ?? []) {
        const shots = await asc("GET", `/appScreenshotSets/${s.id}/appScreenshots?limit=10&fields[appScreenshots]=fileName,assetDeliveryState`);
        const ok = (shots.data ?? []).filter((x) => x.attributes.assetDeliveryState?.state === "COMPLETE").length;
        names.push(`${s.attributes.screenshotDisplayType}:${ok}/${shots.data?.length ?? 0}`);
      }
      line("  screenshot sets", names.join("  ") || "none");
    } catch (e) { line("  screenshot sets", "unreadable: " + String(e.message).slice(0, 70)); }
  }
} catch (e) { line("localizations", "unreadable: " + String(e.message).slice(0, 80)); }

// ── The gates Apple blocks submission on ──
for (const [label, path, pick] of [
  ["review detail", `/appStoreVersions/${v.id}/appStoreReviewDetail`, (d) => `contact ${d?.attributes?.contactFirstName ?? "?"} ${d?.attributes?.contactLastName ?? ""} · ${d?.attributes?.contactEmail ?? "no email"} · demo ${d?.attributes?.demoAccountRequired ? "required" : "not required"}`],
  ["export compliance", `/appStoreVersions/${v.id}?fields[appStoreVersions]=usesNonExemptEncryption`, (d) => String(d?.attributes?.usesNonExemptEncryption)],
  ["age rating", `/apps/${APP_ID}/ageRatingDeclaration`, (d) => (d ? "present" : "MISSING")],
]) {
  try {
    const r = await asc("GET", path);
    line(label, pick(r.data));
  } catch (e) { line(label, "unreadable: " + String(e.message).split("→").pop().trim().slice(0, 80)); }
}

// ── Accessibility (separate from the version) ──
try {
  const acc = await asc("GET", `/apps/${APP_ID}/accessibilityDeclarations`);
  for (const d of acc.data ?? []) line("accessibility", `${d.attributes.deviceFamily}: ${d.attributes.state}`);
} catch (e) { line("accessibility", "unreadable"); }

console.log("");
