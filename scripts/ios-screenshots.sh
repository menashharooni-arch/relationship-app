#!/usr/bin/env bash
# Capture the App Store 6.9-inch screenshot set from the REAL app.
#
#   npm run ios:screenshots
#
# You sign in ONCE by hand; this captures every shot after that.
#
# HOW IT WORKS: the shell is a remote-URL app, so which screen it shows is just
# server.url in the generated (gitignored) ios/App/App/capacitor.config.json.
# This rewrites that per shot, reinstalls, relaunches, and screenshots. The
# WKWebView cookie store survives reinstall, so the session you established by
# hand persists across all of them.
#
# WHY NOT AUTOMATE THE SIGN-IN TOO: /auth/callback is PKCE-only, so an
# admin-generated magic link cannot establish a server session, and simulators
# cannot be tapped without granting Accessibility permission. One manual sign-in
# is the cheapest honest path.
#
# BEFORE RUNNING — sign in inside the simulator:
#   1. npm run ios:sim
#   2. In the Simulator, sign in as applereview@swiftcard.me
#      (password: ~/.swiftcard/apple-review-account.txt)
#   3. Ctrl-C the console, then run this.
#
# Output: app-store/screenshots/6.9-inch/*.png at 1320 x 2868.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIM="${SIM_DEVICE:-iPhone 17 Pro Max}"
OUT="$ROOT/app-store/screenshots/6.9-inch"
CFG="$ROOT/ios/App/App/capacitor.config.json"
BUNDLE="me.swiftcard.app"
BASE="https://swiftcard.me"

# name|path — the shot list from docs/ios-review/APP-STORE-METADATA.md.
SHOTS=(
  "03-dashboard|/dashboard"
  "04-contacts|/contacts"
  "05-swift-links|/links"
)

command -v xcrun >/dev/null || { echo "error: Xcode command line tools required" >&2; exit 1; }
mkdir -p "$OUT"

# A 6.9" device is what the App Store wants; anything else is the wrong pixel size.
xcrun simctl boot "$SIM" 2>/dev/null || true
xcrun simctl bootstatus "$SIM" -b >/dev/null
open -a Simulator

restore() {
  cd "$ROOT" && npx cap sync ios >/dev/null 2>&1 || true
  echo "Restored server.url to $BASE"
}
trap restore EXIT

APP_PATH=""
build_and_launch() {
  local url="$1"
  python3 - "$CFG" "$url" <<'PY'
import json, sys
p, url = sys.argv[1], sys.argv[2]
c = json.load(open(p)); c["server"]["url"] = url
json.dump(c, open(p, "w"), indent=2)
PY
  cd "$ROOT/ios/App"
  xcodebuild -scheme App -configuration Debug -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' \
    CODE_SIGN_IDENTITY="-" CODE_SIGN_STYLE=Manual \
    DEVELOPMENT_TEAM="" PROVISIONING_PROFILE_SPECIFIER="" \
    build >/dev/null
  if [[ -z "$APP_PATH" ]]; then
    APP_PATH="$(xcodebuild -scheme App -configuration Debug -sdk iphonesimulator -showBuildSettings 2>/dev/null \
      | awk -F' = ' '/ BUILT_PRODUCTS_DIR /{print $2; exit}')/App.app"
  fi
  xcrun simctl terminate "$SIM" "$BUNDLE" 2>/dev/null || true
  # NOT uninstall — that would wipe the cookie store and your sign-in with it.
  xcrun simctl install "$SIM" "$APP_PATH"
  xcrun simctl launch "$SIM" "$BUNDLE" >/dev/null
}

for shot in "${SHOTS[@]}"; do
  name="${shot%%|*}"; path="${shot#*|}"
  echo "→ $name  ($path)"
  build_and_launch "$BASE$path"
  sleep 12   # remote page load + client hydration
  xcrun simctl io "$SIM" screenshot "$OUT/$name.png" >/dev/null
  dims="$(sips -g pixelWidth -g pixelHeight "$OUT/$name.png" | awk '/pixel/{printf "%s ", $2}')"
  echo "   saved ${dims}→ $OUT/$name.png"
  case "$dims" in
    "1320 2868 ") ;;
    *) echo "   WARNING: expected 1320 x 2868 — is SIM_DEVICE a 6.9-inch iPhone?" ;;
  esac
done

echo
echo "Done. Check each one actually shows signed-in content — if you see the"
echo "login screen, the session lapsed; sign in again and re-run."
