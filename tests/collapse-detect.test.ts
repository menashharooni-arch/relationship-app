import { describe, it, expect } from "vitest";
import { isCollapsedWhileVisible } from "@/lib/collapse-detect";

// This predicate decides whether CardScaler reports an invisible render to the
// production error log. Both directions are load-bearing:
//   • too strict  -> the SwiftLink-preview class of bug stays silent again
//   • too loose   -> the error log fills with false alarms, which is exactly
//                    what the uptime-probe incident cost us
// so every legitimate zero-width state in the app is pinned here.

describe("isCollapsedWhileVisible", () => {
  it("flags an on-screen element that has collapsed to zero width (the shipped bug)", () => {
    expect(isCollapsedWhileVisible({ clientWidth: 0, offsetParent: {} })).toBe(true);
  });

  it("ignores display:none subtrees — offsetParent is null there", () => {
    // Real cases: the mobile plan tabs hide 2 of 3 plan cards, and a closed
    // mini-builder modal keeps its preview mounted but hidden. Both measure 0
    // correctly and must never be reported.
    expect(isCollapsedWhileVisible({ clientWidth: 0, offsetParent: null })).toBe(false);
  });

  it("ignores a detached node (mid-unmount)", () => {
    expect(isCollapsedWhileVisible({ clientWidth: 0, offsetParent: {}, isConnected: false })).toBe(false);
  });

  it("ignores a healthy, measured slot", () => {
    expect(isCollapsedWhileVisible({ clientWidth: 318, offsetParent: {} })).toBe(false);
    expect(isCollapsedWhileVisible({ clientWidth: 1, offsetParent: {} })).toBe(false);
  });

  it("treats sub-pixel width as collapsed — scale would still round to nothing", () => {
    expect(isCollapsedWhileVisible({ clientWidth: 0.4, offsetParent: {} })).toBe(true);
  });

  it("is safe on null/undefined refs (unmounted, or SSR)", () => {
    expect(isCollapsedWhileVisible(null)).toBe(false);
    expect(isCollapsedWhileVisible(undefined)).toBe(false);
  });
});
