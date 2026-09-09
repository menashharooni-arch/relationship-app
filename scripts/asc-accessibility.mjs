// node scripts/asc-accessibility.mjs [--apply]
//
// The Accessibility Nutrition Labels, as data rather than as clicks.
//
// Apple treats these as a DECLARATION: you assert what the app supports and the
// App Store shows it to people who need it. So the values here are exactly the
// ones scripts/qa-a11y.mjs measures to zero findings across the eight screens
// the iOS shell actually shows, at 390px and 1280px — nothing is ticked because
// it seems likely.
//
// Run with no arguments to print the live state. Run with --apply to write it.
// The API can only create/edit a DRAFT; the final Publish is a button in App
// Store Connect (Apple exposes no publish endpoint), which is the right place
// for a human to sign off on a public accuracy claim.
import { asc, APP_ID } from "./lib/asc.mjs";

// Verified by scripts/qa-a11y.mjs (axe-core WCAG 2.0/2.1 A+AA + six checks axe
// does not do: text scaling, clipping at 200%, reduced motion, dark, accessible
// name vs visible label, focus indicators).
const SUPPORTED = {
  supportsVoiceover: true,
  supportsVoiceControl: true,
  supportsLargerText: true,
  supportsSufficientContrast: true,
  supportsDifferentiateWithoutColorAlone: true,
  supportsDarkInterface: true,
  supportsReducedMotion: true,
  // The app plays no video and no speech audio, so these do not apply. Stating
  // false is honest; leaving them unanswered reads as an omission.
  supportsCaptions: false,
  supportsAudioDescriptions: false,
};

// IPHONE only, deliberately. MAC is a separate declaration and must not be
// filled in from the iPhone measurements: the web layer is identical, but
// VoiceOver on macOS is a different experience and has not been driven on real
// hardware. Add it here once it has.
const FAMILIES = ["IPHONE"];

const apply = process.argv.includes("--apply");
const existing = await asc("GET", `/apps/${APP_ID}/accessibilityDeclarations`);
const byFamily = Object.fromEntries(existing.data.map((d) => [d.attributes.deviceFamily, d]));

for (const family of FAMILIES) {
  let row = byFamily[family];
  if (!row) {
    if (!apply) { console.log(`${family}: MISSING (run with --apply to create)`); continue; }
    row = (await asc("POST", "/accessibilityDeclarations", {
      data: { type: "accessibilityDeclarations", attributes: { deviceFamily: family },
              relationships: { app: { data: { type: "apps", id: APP_ID } } } },
    })).data;
    console.log(`${family}: created ${row.id}`);
  }
  const drift = Object.entries(SUPPORTED).filter(([k, v]) => row.attributes[k] !== v);
  if (!drift.length) { console.log(`${family}: ${row.attributes.state} — all values already correct`); continue; }
  if (!apply) {
    console.log(`${family}: ${row.attributes.state} — ${drift.length} value(s) differ:`);
    for (const [k, v] of drift) console.log(`    ${k}: ${row.attributes[k]} → ${v}`);
    continue;
  }
  const out = await asc("PATCH", `/accessibilityDeclarations/${row.id}`, {
    data: { type: "accessibilityDeclarations", id: row.id, attributes: SUPPORTED },
  });
  console.log(`${family}: ${out.data.attributes.state} — wrote ${drift.length} value(s)`);
}

const after = await asc("GET", `/apps/${APP_ID}/accessibilityDeclarations`);
console.log("\nlive state:");
for (const d of after.data) {
  const on = Object.entries(d.attributes).filter(([k, v]) => k.startsWith("supports") && v === true).map(([k]) => k.replace("supports", ""));
  console.log(`  ${d.attributes.deviceFamily}  ${d.attributes.state}  →  ${on.join(", ") || "(nothing ticked)"}`);
}
if (after.data.some((d) => d.attributes.state === "DRAFT")) {
  console.log("\nStill a DRAFT. App Store Connect → your app → Accessibility → Publish.");
}
