#!/usr/bin/env bash
# Archive, sign, export and upload SwiftCard to App Store Connect — in one go.
#
#   npm run ios:release            # archive + export + upload
#   npm run ios:release -- --dry   # archive + export + validate, no upload
#
# WHY THIS EXISTS: signing normally means an Apple ID typed into Xcode →
# Settings → Accounts, with 2FA. You do not need that. An App Store Connect API
# key authenticates BOTH halves headlessly: xcodebuild uses it to mint the
# distribution certificate and provisioning profiles (-allowProvisioningUpdates
# + -authenticationKey*), and the same key authorises the upload. One credential,
# no password, no 2FA prompt, repeatable in CI later.
#
# ONE-TIME SETUP — create the key, then drop three values here:
#   1. appstoreconnect.apple.com → Users and Access → Integrations →
#      App Store Connect API → Team Keys → (+). Role: App Manager (Admin also
#      works). Download the .p8 — it downloads ONCE.
#   2. Note the Key ID (next to the key) and the Issuer ID (above the table).
#   3. Put them in ~/.swiftcard/asc/ :
#        mkdir -p ~/.swiftcard/asc && chmod 700 ~/.swiftcard/asc
#        mv ~/Downloads/AuthKey_<KEYID>.p8 ~/.swiftcard/asc/
#        echo '<KEYID>'   > ~/.swiftcard/asc/key-id
#        echo '<ISSUERID>'> ~/.swiftcard/asc/issuer-id
#        chmod 600 ~/.swiftcard/asc/*
#
# This is a DIFFERENT key from ~/.swiftcard/keys/AuthKey_C8TWRXCNKA.p8, which is
# the Sign in with Apple / APNs key. Do not mix them up: an APNs key has no App
# Store Connect authority and fails here with a confusing 401.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASC="$HOME/.swiftcard/asc"
BUILD="$ROOT/ios/build"
ARCHIVE="$BUILD/SwiftCard.xcarchive"
EXPORT_DIR="$BUILD/export"
DRY=0
[[ "${1:-}" == "--dry" ]] && DRY=1

die() { printf '\nerror: %s\n' "$1" >&2; exit 1; }

# ── credentials ──────────────────────────────────────────────────────────────
KEY_FILE="$(ls "$ASC"/AuthKey_*.p8 2>/dev/null | head -1 || true)"
[[ -n "$KEY_FILE" ]] || die "no App Store Connect API key at $ASC/AuthKey_*.p8 — see the setup notes at the top of this script."
[[ -f "$ASC/key-id" ]]    || die "missing $ASC/key-id"
[[ -f "$ASC/issuer-id" ]] || die "missing $ASC/issuer-id"
KEY_ID="$(tr -d '[:space:]' < "$ASC/key-id")"
ISSUER_ID="$(tr -d '[:space:]' < "$ASC/issuer-id")"

# xcodebuild only looks for keys in a few fixed locations unless given a path;
# -authenticationKeyPath wants an absolute one.
AUTH=(-allowProvisioningUpdates
      -authenticationKeyPath "$KEY_FILE"
      -authenticationKeyID "$KEY_ID"
      -authenticationKeyIssuerID "$ISSUER_ID")

# altool is different: --apiKey does NOT take a path. It searches ./private_keys,
# ~/private_keys, ~/.private_keys and ~/.appstoreconnect/private_keys — or the
# directory named by API_PRIVATE_KEYS_DIR. Without this line, validate/upload
# fails with "could not find the private key" even though xcodebuild just used
# the very same key successfully.
export API_PRIVATE_KEYS_DIR="$ASC"

echo "Using ASC key $KEY_ID (issuer ${ISSUER_ID:0:8}…)"

# ── signing assets (created by scripts/asc-provision.mjs) ────────────────────
# The Apple Distribution identity lives in a dedicated keychain with its own
# password, so no login-keychain password and no GUI prompt is ever needed.
DIST="$HOME/.swiftcard/dist"
KC="$HOME/Library/Keychains/swiftcard-release.keychain-db"
if [[ ! -f "$DIST/keychain-pass" || ! -f "$KC" ]]; then
  die "signing assets missing — run: node scripts/asc-provision.mjs (see that script's header)"
fi
security unlock-keychain -p "$(cat "$DIST/keychain-pass")" "$KC"
security list-keychains -d user | grep -q swiftcard-release || \
  security list-keychains -d user -s "$KC" "$HOME/Library/Keychains/login.keychain-db"
security find-identity -v -p codesigning "$KC" | grep -q "Apple Distribution" || \
  die "no Apple Distribution identity in $KC — re-run scripts/asc-provision.mjs and the keychain setup"
echo "Signing identity ready."

# ── keep the web assets in step ──────────────────────────────────────────────
cd "$ROOT"
npx cap sync ios

# ── archive ──────────────────────────────────────────────────────────────────
# The archive is deliberately UNSIGNED (CODE_SIGNING_ALLOWED=NO). Signing an
# archive with automatic style wants an "Apple Development" profile, and
# development profiles require at least one registered device — this team has
# none, so a signed archive fails with "Your team has no devices". App Store
# distribution profiles require NO devices, and -exportArchive below does the
# actual distribution signing. Archive unsigned → sign at export is the
# standard device-less CI pattern.
rm -rf "$ARCHIVE" "$EXPORT_DIR"
mkdir -p "$BUILD"
cd "$ROOT/ios/App"
echo "Archiving (unsigned — distribution signing happens at export)…"
xcodebuild -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  archive

# ── export (and upload, unless --dry) ────────────────────────────────────────
# `destination: upload` in ExportOptions would upload during export; we export
# to disk first so a failed upload doesn't cost a fresh 3-minute archive, and so
# --dry can validate the very same .ipa that would ship.
echo "Exporting…"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$ROOT/ios/App/ExportOptions.plist" \
  -exportPath "$EXPORT_DIR" \
  "${AUTH[@]}"

IPA="$(ls "$EXPORT_DIR"/*.ipa 2>/dev/null | head -1 || true)"
[[ -n "$IPA" ]] || die "export produced no .ipa (look in $EXPORT_DIR)"
echo "Built $(basename "$IPA") ($(du -h "$IPA" | cut -f1))"

# Validation catches the things App Store Connect would reject hours later:
# missing privacy manifest reasons, bad icon, entitlement/profile mismatch,
# app-vs-extension version skew.
echo "Validating with Apple…"
xcrun altool --validate-app -f "$IPA" -t ios \
  --apiKey "$KEY_ID" --apiIssuer "$ISSUER_ID"

if [[ "$DRY" == "1" ]]; then
  echo
  echo "--dry: validated but NOT uploaded. IPA: $IPA"
  exit 0
fi

echo "Uploading to App Store Connect…"
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$KEY_ID" --apiIssuer "$ISSUER_ID"

echo
echo "Uploaded. It takes ~5-15 min to finish processing, then it appears under"
echo "the 1.0.0 version in App Store Connect → TestFlight / App Store."
