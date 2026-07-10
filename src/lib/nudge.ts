// The signup "follow-up" nudge popup was removed from the product. This is kept
// as an inert no-op so the existing call sites (save / share / tap flows)
// compile unchanged and simply do nothing — the popup never appears anywhere.
export function triggerSignupNudge(_source: string): void {
  /* removed — no popup */
}
