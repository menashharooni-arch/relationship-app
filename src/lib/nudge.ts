// Fire-and-forget trigger for the shared signup nudge. Call this AFTER the
// visitor's own action (save, share, download, tap) has finished — never before.
export function triggerSignupNudge(source: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sc:nudge", { detail: { source } }));
}

/**
 * Like triggerSignupNudge, but delivered when the page is actually VISIBLE.
 *
 * The vCard/save flows hand the visitor to a system sheet ("Add to Contacts",
 * the OS share sheet) and iOS throttles background timers — a bare setTimeout
 * fired the nudge into a page nobody was looking at, spending its
 * once-per-session slot invisibly. This waits out the delay, then, if the page
 * is hidden, holds the nudge until the visitor comes back to it.
 */
export function triggerSignupNudgeWhenVisible(source: string, delayMs = 0): void {
  if (typeof window === "undefined") return;
  const fire = () => {
    if (document.visibilityState === "visible") {
      triggerSignupNudge(source);
      return;
    }
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisible);
      triggerSignupNudge(source);
    };
    document.addEventListener("visibilitychange", onVisible);
  };
  if (delayMs > 0) setTimeout(fire, delayMs);
  else fire();
}
