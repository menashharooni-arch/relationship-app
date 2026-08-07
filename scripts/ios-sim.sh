#!/usr/bin/env bash
# Build the SwiftCard iOS shell, install it on a booted simulator, and launch it.
#
#   npm run ios:sim              # iPhone 17 Pro
#   npm run ios:sim -- "iPhone Air"
#
# Signs ad-hoc (CODE_SIGN_IDENTITY="-") rather than disabling signing, because
# CODE_SIGNING_ALLOWED=NO strips entitlements — and without them the
# group.me.swiftcard.app container is never created, so the home-screen widget
# silently reads nothing. Device builds and archives need a real Apple ID in
# Xcode → Settings → Accounts (team NHK8FA2RR2); this path does not.
set -euo pipefail

DEVICE="${1:-iPhone 17 Pro}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_ID="me.swiftcard.app"

cd "$ROOT"
npx cap sync ios

cd "$ROOT/ios/App"
xcodebuild -scheme App -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGN_IDENTITY="-" CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM="" PROVISIONING_PROFILE_SPECIFIER="" \
  build

APP_PATH="$(xcodebuild -scheme App -configuration Debug -sdk iphonesimulator -showBuildSettings 2>/dev/null \
  | awk -F' = ' '/ BUILT_PRODUCTS_DIR /{print $2; exit}')/App.app"

# `simctl boot` on an already-booted device exits non-zero; that is not an error.
xcrun simctl boot "$DEVICE" 2>/dev/null || true
xcrun simctl bootstatus "$DEVICE" -b >/dev/null
open -a Simulator

xcrun simctl install "$DEVICE" "$APP_PATH"
xcrun simctl terminate "$DEVICE" "$BUNDLE_ID" 2>/dev/null || true

echo "--- app console (ctrl-c to stop) ---"
exec xcrun simctl launch --console-pty "$DEVICE" "$BUNDLE_ID"
