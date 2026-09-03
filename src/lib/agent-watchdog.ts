import agentConfig from "../../marketing-agents/config.json";

// ── Arming the always-on watch ───────────────────────────────────────────────
//
// Owner order (2026-09-03): Finn, Bo, Vera and Dash have NO schedules. They
// watch continuously while the office is open and their Active box is ticked,
// and only Menash stops them.
//
// The loop lives in .github/workflows/agent-watchdog.yml and re-arms itself
// every 5h30m, so it normally needs no help staying alive. It stands itself
// down — on purpose — when the office closes or the last watchdog goes
// inactive. This helper is what turns it back ON the instant the owner flips
// either switch back, instead of making him wait up to an hour for the backstop
// cron. `concurrency` on the workflow means arming an already-live watch is a
// harmless no-op, so this can be called freely.

const REPO = process.env.AGENTS_GITHUB_REPO || "menashharooni-arch/relationship-app";
const WATCHDOG_WORKFLOW = "agent-watchdog.yml";

/** The agent_ids that watch continuously rather than on a cadence. */
export const CONTINUOUS_AGENTS: string[] = Object.entries(
  agentConfig.agents as Record<string, { continuous?: boolean }>,
)
  .filter(([, a]) => a.continuous)
  .map(([id]) => id);

export function isContinuous(agentId: string | null | undefined): boolean {
  return !!agentId && CONTINUOUS_AGENTS.includes(agentId);
}

/**
 * Make sure the watchdog loop is running. Never throws — arming the watch must
 * not be able to fail the control action the owner actually pressed.
 */
export async function armWatchdogLoop(trigger: string): Promise<boolean> {
  const token = process.env.GITHUB_AGENTS_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WATCHDOG_WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        body: JSON.stringify({ ref: "main", inputs: { trigger } }),
      },
    );
    return res.status === 204;
  } catch {
    return false;
  }
}
