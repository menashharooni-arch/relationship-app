import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Comments describe the failures being guarded against, so strip them before
// scanning or the prose trips the assertions.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

// Balance braces from a function's opening `{`; a regex stopping at the first
// `}` truncates at the first nested block and lets violations below it through.
function functionBody(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  if (at === -1) throw new Error(`${name}() not found`);
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}()`);
}

// A connected CRM that silently stops working is the worst failure mode here:
// Settings keeps showing "Connected", no contacts arrive, and nobody finds out.
// Token-REFRESH failures were always reported via sync_error (which Settings
// renders as an amber reconnect prompt). The actual create/update calls were
// only console.warn'd — so a Google project without the People API enabled, or
// a HubSpot grant missing crm.objects.contacts.write, failed on every single
// lead forever while looking perfectly healthy.
//
// This is the same shape as the Twilio "said Sent, never arrived" bug.

describe("CRM sync failures are visible, not silent", () => {
  for (const [provider, file, fn] of [
    ["Google Contacts", "src/lib/sync-google.ts", "syncLeadToGoogle"],
    ["HubSpot", "src/lib/sync-hubspot.ts", "syncLeadToHubSpot"],
  ] as const) {
    const body = functionBody(stripComments(read(file)), fn);

    it(`${provider}: a rejected contact writes sync_error`, () => {
      expect(body).toContain("setSyncError(");
    });

    it(`${provider}: a later success clears the banner, and only when one is showing`, () => {
      // The guard matters: clearing unconditionally would write to the database
      // on every captured lead just to set null to null.
      expect(body).toMatch(/if \(auth\.syncError\) await setSyncError\(userId, null\)/);
    });

    it(`${provider}: auth failures tell the user to reconnect`, () => {
      // 401/403 is the realistic case (scope never granted, API not enabled) and
      // needs different advice from a transient 5xx — retrying won't fix it.
      expect(body).toMatch(/401 \|\| res\.status === 403/);
      expect(body.toLowerCase()).toContain("reconnect");
    });
  }
});

describe("integrations are re-checked against the plan at send time", () => {
  // A stored token or webhook URL survives a downgrade. dispatchCrmEvent
  // already re-checked isPaidPlan before firing view/notification events; the
  // lead path did not — so one lapsed account could still be syncing leads to
  // HubSpot while its other events had already stopped.
  const src = stripComments(read("src/app/api/leads/route.ts"));

  it("Google + HubSpot sync only for a paid owner", () => {
    const at = src.indexOf("syncLeadToGoogle(");
    expect(at).toBeGreaterThan(-1);
    // Walk back to the enclosing condition rather than assuming a line offset.
    const before = src.slice(Math.max(0, at - 400), at);
    expect(before).toMatch(/isPaidPlan\(ownerProfile\.plan\)/);
  });

  it("the Zapier lead webhook only fires for a paid owner", () => {
    const at = src.indexOf("zapier_webhook_url && ");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 200)).toContain("isPaidPlan(ownerProfile.plan)");
  });

  it("the Zapier URL is still allowlisted before any PII leaves", () => {
    // Unrelated to plan, but it shares the same condition — a refactor that
    // drops it turns this into an open SSRF/exfiltration hole.
    expect(src).toContain("isZapierWebhookUrl(ownerProfile.zapier_webhook_url)");
  });
});
