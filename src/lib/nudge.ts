// Fire-and-forget trigger for the shared signup nudge. Call this AFTER the
// visitor's own action (save, share, download, tap) has finished — never before.
export function triggerSignupNudge(source: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sc:nudge", { detail: { source } }));
}
