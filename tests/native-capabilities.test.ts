import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isApnsEndpoint, APNS_PREFIX } from "@/lib/apns";

// ── Native-capability wiring for the Capacitor iOS shell ─────────────────────
// These guards assert the shell's native integrations stay wired: the
// system-browser OAuth flow (Google blocks embedded-webview OAuth), APNs push,
// universal-link navigation, native share, and Wallet hand-off. All of it is
// native-gated; the web bundle only ever loads the plugins via dynamic import
// inside detectNativeApp() branches.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("apns endpoint namespacing", () => {
  it("recognizes apns-prefixed endpoints and rejects web push endpoints", () => {
    expect(isApnsEndpoint(`${APNS_PREFIX}abcdef123`)).toBe(true);
    expect(isApnsEndpoint("https://fcm.googleapis.com/fcm/send/xyz")).toBe(false);
    expect(isApnsEndpoint(null)).toBe(false);
    expect(isApnsEndpoint(undefined)).toBe(false);
    expect(isApnsEndpoint("")).toBe(false);
  });
});

describe("push routing splits APNs from web-push", () => {
  const src = read("src/lib/push.ts");
  it("filters subscriptions by isApnsEndpoint and sends via sendApnsNotification", () => {
    expect(src).toMatch(/isApnsEndpoint/);
    expect(src).toMatch(/sendApnsNotification/);
    // web-push must stay for browser subscriptions
    expect(src).toMatch(/webpush\.sendNotification/);
  });
  it("prunes dead APNs tokens like web-push prunes 404/410", () => {
    expect(src).toMatch(/result === "gone"[\s\S]*?delete\(\)\.eq\("endpoint", sub\.endpoint\)/);
  });
});

describe("native OAuth uses the system browser, not the webview", () => {
  const login = read("src/components/LoginForm.tsx");
  const auth = read("src/lib/native-auth.ts");
  it("LoginForm's native Google handler routes through startNativeOAuth", () => {
    expect(login).toMatch(/if \(native\) \{[\s\S]*?startNativeOAuth\(supabase, "google", redirectTo, mode\)/);
  });
  it("Apple handler routes through startNativeOAuth", () => {
    expect(login).toMatch(/startNativeOAuth\(supabase, "apple", redirectTo, mode\)/);
  });
  it("native-auth opens the provider URL via @capacitor/browser with skipBrowserRedirect", () => {
    expect(auth).toMatch(/skipBrowserRedirect: true/);
    expect(auth).toMatch(/@capacitor\/browser/);
    expect(auth).toMatch(/swiftcard:\/\/auth-callback/);
  });
  it("completeNativeOAuth only accepts the swiftcard: scheme", () => {
    expect(auth).toMatch(/u\.protocol !== "swiftcard:"\) return false/);
  });
});

describe("NativeAppBridge is mounted and handles links + push taps", () => {
  const layout = read("src/app/layout.tsx");
  const bridge = read("src/components/NativeAppBridge.tsx");
  it("mounted in the root layout", () => {
    expect(layout).toMatch(/<NativeAppBridge \/>/);
  });
  it("no-ops on web (guards on detectNativeApp before any plugin import)", () => {
    expect(bridge).toMatch(/if \(!detectNativeApp\(\)\) return;/);
  });
  it("only navigates to our own origin from universal links", () => {
    expect(bridge).toMatch(/u\.hostname === "swiftcard\.me" \|\| u\.hostname === "www\.swiftcard\.me"/);
  });
  it("push taps only navigate to same-origin paths", () => {
    // Now the shared guard (rejects "//" and "/\\" alike).
    expect(bridge).toMatch(/safeNextPath\(dest\)/);
  });
});

describe("AASA covers the OAuth return path", () => {
  const aasa = read("src/app/.well-known/apple-app-site-association/route.ts");
  it("includes /auth/callback alongside card and links paths", () => {
    expect(aasa).toMatch(/"\/card\/\*", "\/links\/\*", "\/join\/\*", "\/auth\/callback"/);
  });
});

describe("iOS shell project wiring", () => {
  it("Info.plist registers the swiftcard:// scheme and purpose strings", () => {
    const plist = read("ios/App/App/Info.plist");
    expect(plist).toContain("<string>swiftcard</string>");
    expect(plist).toContain("NSCameraUsageDescription");
    expect(plist).toContain("NSPhotoLibraryUsageDescription");
  });
  it("entitlements carry associated domains + aps-environment and are wired into the build", () => {
    const ent = read("ios/App/App/App.entitlements");
    expect(ent).toContain("applinks:swiftcard.me");
    expect(ent).toContain("aps-environment");
    const pbx = read("ios/App/App.xcodeproj/project.pbxproj");
    expect(pbx).toContain("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;");
  });
  it("official Capacitor plugins are dependencies", () => {
    const pkg = JSON.parse(read("package.json"));
    for (const p of ["@capacitor/browser", "@capacitor/app", "@capacitor/push-notifications", "@capacitor/share"]) {
      expect(pkg.dependencies[p]).toBeTruthy();
    }
  });
});

describe("home-screen QR widget wiring", () => {
  it("bridge syncs the active card through the WidgetBridge native plugin", () => {
    const bridge = read("src/components/NativeAppBridge.tsx");
    expect(bridge).toMatch(/Plugins\?\.WidgetBridge/);
    expect(bridge).toMatch(/setCard\(/);
    expect(bridge).toMatch(/source=widget/);
  });
  // Regression guard for the bug this replaced: @capacitor/preferences' `group`
  // option is only a key prefix on UserDefaults.standard, which lives in the
  // app's own container. A widget extension cannot read it, so routing the card
  // through Preferences left the widget permanently on its empty state.
  it("bridge does NOT route widget data through @capacitor/preferences", () => {
    const bridge = read("src/components/NativeAppBridge.tsx");
    expect(bridge).not.toMatch(/await\s+Preferences\.set/);
    expect(bridge).not.toMatch(/import\("@capacitor\/preferences"\)/);
  });
  it("app + widget entitlements share the app group", () => {
    expect(read("ios/App/App/App.entitlements")).toContain("group.me.swiftcard.app");
    expect(read("ios/App/SwiftCardWidget/SwiftCardWidget.entitlements")).toContain("group.me.swiftcard.app");
  });
  it("WidgetBridge writes the real App Group suite the widget reads", () => {
    const b = read("ios/App/App/WidgetBridge.swift");
    // The suite — not UserDefaults.standard — is what makes the data visible.
    expect(b).toMatch(/UserDefaults\(suiteName:/);
    expect(b).toContain('appGroup = "group.me.swiftcard.app"');
    expect(b).toContain('storeKey = "widget_card"');
    // Without an explicit reload the widget keeps its snapshot for 6 hours.
    expect(b).toMatch(/WidgetCenter\.shared\.reloadTimelines\(ofKind: "SwiftCardQR"\)/);
  });
  it("widget reads the same group/key and QR-encodes the card url", () => {
    const w = read("ios/App/SwiftCardWidget/SwiftCardWidget.swift");
    expect(w).toContain('APP_GROUP = "group.me.swiftcard.app"');
    expect(w).toContain('STORE_KEY = "widget_card"');
    expect(w).toContain("qrCodeGenerator");
    // The kind string must match what WidgetBridge reloads.
    expect(w).toContain('kind: "SwiftCardQR"');
  });
  // Capacitor does NOT scan the ObjC runtime for plugins. registerPlugins()
  // uses five hardcoded built-ins plus capacitor.config.json's packageClassList,
  // which `cap sync` regenerates from npm packages only — so an app-local plugin
  // is invisible to it however correctly it is written. WidgetBridge shipped
  // unregistered exactly once; window.Capacitor.Plugins.WidgetBridge was
  // undefined, the optional call no-opped, and the widget stayed empty.
  it("WidgetBridge is explicitly registered — Capacitor will not find it alone", () => {
    const vc = read("ios/App/App/MainViewController.swift");
    expect(vc).toContain("CAPBridgeViewController");
    expect(vc).toMatch(/override func capacitorDidLoad\(\)/);
    expect(vc).toMatch(/registerPluginInstance\(WidgetBridgePlugin\(\)\)/);
    // registerPluginType early-returns while autoRegisterPlugins is true (its
    // default), so a call to it would silently do nothing. Ignore comment lines
    // — the file deliberately explains why that API is the wrong one.
    const code = vc
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toMatch(/registerPluginType\s*\(/);
  });

  it("the storyboard instantiates that subclass, not the stock controller", () => {
    // Registration only happens if this view controller is the one that loads.
    const sb = read("ios/App/App/Base.lproj/Main.storyboard");
    expect(sb).toContain('customClass="MainViewController"');
    expect(sb).not.toContain('customClass="CAPBridgeViewController"');
    expect(read("ios/App/App.xcodeproj/project.pbxproj")).toContain(
      "MainViewController.swift in Sources"
    );
  });

  it("a missing App Group is detected by the container, not by suiteName", () => {
    // UserDefaults(suiteName:) returns non-nil even without the entitlement, so
    // writes would silently go somewhere the widget cannot read.
    const b = read("ios/App/App/WidgetBridge.swift");
    expect(b).toMatch(/containerURL\(\s*forSecurityApplicationGroupIdentifier:/);
  });

  it("the widget is cleared on sign-out, not left showing the last account", () => {
    const bridge = read("src/components/NativeAppBridge.tsx");
    expect(bridge).toMatch(/clearCard\(\)/);
  });

  it("the widget target is actually in the Xcode project", () => {
    // The extension's source existed on disk for weeks without a target to
    // build it — the app shipped no widget at all.
    const proj = read("ios/App/App.xcodeproj/project.pbxproj");
    expect(proj).toContain("SwiftCardWidgetExtension");
    expect(proj).toContain('productType = "com.apple.product-type.app-extension"');
    expect(proj).toContain("SwiftCardWidget.swift in Sources");
    // Embedded into the app bundle's PlugIns folder, or it never installs.
    expect(proj).toContain("Embed Foundation Extensions");
    expect(proj).toMatch(/dstSubfolderSpec = 13;/);
  });
});

describe("APNs delegate forwarding", () => {
  // PushNotifications.register() resolves only when the AppDelegate reposts
  // the UIApplication callbacks as Capacitor notifications. Without these the
  // registration listener in EnablePushButton just times out.
  it("AppDelegate forwards both APNs registration outcomes", () => {
    const d = read("ios/App/App/AppDelegate.swift");
    expect(d).toMatch(/didRegisterForRemoteNotificationsWithDeviceToken/);
    expect(d).toContain(".capacitorDidRegisterForRemoteNotifications");
    expect(d).toMatch(/didFailToRegisterForRemoteNotificationsWithError/);
    expect(d).toContain(".capacitorDidFailToRegisterForRemoteNotifications");
  });
});

describe("Liquid-Glass native styling layer", () => {
  const css = read("src/app/globals.css");
  const bridge = read("src/components/NativeAppBridge.tsx");
  it("NativeAppBridge stamps html.native-app and injects viewport-fit only on native", () => {
    expect(bridge).toMatch(/classList\.add\("native-app"\)/);
    expect(bridge).toMatch(/viewport-fit=cover/);
    // both must sit AFTER the detectNativeApp() guard — web untouched
    expect(bridge.indexOf('classList.add("native-app")')).toBeGreaterThan(bridge.indexOf("if (!detectNativeApp()) return;"));
  });
  it("every glass rule is scoped under html.native-app (web cannot match)", () => {
    const section = css.slice(css.indexOf("NATIVE SHELL — Liquid-Glass motion layer"));
    expect(section.length).toBeGreaterThan(100);
    // No selector in the section may start outside the native-app scope.
    const selectors = section.split("\n").filter((l) => /^[a-zA-Z.\[@:]/.test(l) && l.includes("{") && !l.startsWith("@"));
    for (const s of selectors) {
      expect(s.trim().startsWith("html.native-app"), `unscoped selector: ${s}`).toBe(true);
    }
  });
  it("accessibility fallbacks exist: reduced motion, reduced transparency, contrast, no-backdrop-filter", () => {
    const section = css.slice(css.indexOf("NATIVE SHELL — Liquid-Glass motion layer"));
    expect(section).toMatch(/prefers-reduced-motion: no-preference/);
    expect(section).toMatch(/prefers-reduced-transparency: reduce/);
    expect(section).toMatch(/prefers-contrast: more/);
    expect(section).toMatch(/@supports not \(\(backdrop-filter/);
  });
  it("MobileNav carries the sc-tabbar anchor class", () => {
    expect(read("src/components/MobileNav.tsx")).toMatch(/className="sc-tabbar /);
  });
});

describe("native share + Wallet hand-off", () => {
  it("ShareButton tries the native share sheet first inside the shell", () => {
    const src = read("src/components/ShareButton.tsx");
    expect(src).toMatch(/detectNativeApp\(\)[\s\S]*?@capacitor\/share/);
  });
  it("AddToWalletButton opens the pass via the system browser on native", () => {
    const src = read("src/components/AddToWalletButton.tsx");
    expect(src).toMatch(/detectNativeApp\(\)/);
    expect(src).toMatch(/@capacitor\/browser/);
  });
  it("EnablePushButton registers APNs tokens through the shared subscribe route", () => {
    const src = read("src/components/EnablePushButton.tsx");
    expect(src).toMatch(/apns:\$\{token\}/);
    expect(src).toMatch(/@capacitor\/push-notifications/);
  });
});
