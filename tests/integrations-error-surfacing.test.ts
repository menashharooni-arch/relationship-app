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
    ["Pipedrive", "src/lib/sync-pipedrive.ts", "syncLeadToPipedrive"],
    ["HighLevel", "src/lib/sync-highlevel.ts", "syncLeadToHighLevel"],
  ] as const) {
    const body = functionBody(stripComments(read(file)), fn);

    it(`${provider}: a rejected contact writes sync_error`, () => {
      // Must match the FAILURE call specifically. A bare "setSyncError(" check
      // is worthless here — the success path also calls it, to clear the
      // banner, so deleting the failure report still left a match. Mutation
      // testing caught that; the passing assertion was proving nothing.
      expect(body).toMatch(/setSyncError\(\s*"[a-z]+",\s*userId,\s*connectionErrorMessage\(/);
    });

    it(`${provider}: a later success clears the banner, and only when one is showing`, () => {
      // The guard matters: clearing unconditionally would write to the database
      // on every captured lead just to set null to null.
      expect(body).toMatch(/if \(conn\.syncError\) await setSyncError\(/);
    });
  }

  it("auth failures tell the user to reconnect, transient ones don't", () => {
    // This assertion used to sit in each sync file. The 401/403 distinction now
    // lives in the shared helper both providers call, so it is checked once,
    // where it actually is — not weakened, relocated.
    //
    // The distinction matters: a 403 means a scope was never granted or an API
    // isn't enabled, and no amount of retrying fixes it, so the copy has to say
    // "reconnect". A 5xx is transient and shouldn't send anyone to settings.
    const helper = stripComments(read("src/lib/crm-connection.ts"));
    const body = functionBody(helper, "connectionErrorMessage");
    expect(body).toMatch(/status === 401 \|\| status === 403/);
    expect(body.toLowerCase()).toContain("reconnect");
    expect(body.toLowerCase()).toContain("keep trying");
  });

  it("the shared helper is what both providers use, so a fix lands once", () => {
    // The duplication this replaced is why the "surface API failures" fix had
    // to be written twice by hand. Two more providers would have made it four.
    for (const f of ["src/lib/sync-google.ts", "src/lib/sync-hubspot.ts"]) {
      expect(read(f)).toContain('from "./crm-connection"');
    }
  });
});

describe("every Settings card points at a route that can serve it", () => {
  // Caught a real regression. HubSpot serves POST from /hubspot/token and
  // DELETE from /hubspot — two different routes, each exporting only its own
  // verb. Generalising the card collapsed them into one prop, so Disconnect
  // sent DELETE to a route with no DELETE handler. The 405 was swallowed by the
  // disconnect catch, so the card flipped to "disconnected" while the row
  // stayed in the database and leads kept syncing. Invisible, and exactly the
  // kind of thing a mismatched URL causes.
  const src = read("src/components/IntegrationsSettings.tsx");

  function routeFileFor(apiPath: string): string {
    return `src/app${apiPath}/route.ts`;
  }

  const saves = [...src.matchAll(/saveEndpoint="([^"]+)"/g)].map((m) => m[1]);
  const disconnects = [...src.matchAll(/disconnectEndpoint="([^"]+)"/g)].map((m) => m[1]);

  it("finds a card for each provider", () => {
    expect(saves.length).toBeGreaterThanOrEqual(3);
    expect(disconnects.length).toBe(saves.length);
  });

  for (const p of saves) {
    it(`POST ${p} has a POST handler`, () => {
      expect(read(routeFileFor(p))).toMatch(/export async function POST/);
    });
  }

  for (const p of disconnects) {
    it(`DELETE ${p} has a DELETE handler`, () => {
      expect(read(routeFileFor(p))).toMatch(/export async function DELETE/);
    });
  }
});

describe("Office: a sub-user's leads reach the agency's CRM", () => {
  const helper = stripComments(read("src/lib/crm-connection.ts"));
  const body = functionBody(helper, "resolveCrmOwnerId");

  it("every provider routes through the resolver, so no CRM misses the office case", () => {
    // A provider that calls getCrmConnection with the capturing user directly
    // would work for solo accounts and silently do nothing for a 12-agent
    // agency — the failure would only show up for the customers paying most.
    for (const f of ["src/lib/sync-google.ts", "src/lib/sync-hubspot.ts", "src/lib/sync-pipedrive.ts", "src/lib/sync-highlevel.ts"]) {
      expect(read(f), `${f} must resolve the office owner`).toContain("resolveCrmOwnerId(");
    }
  });

  it("a personal connection wins over the office one", () => {
    // Order is what keeps this additive. Anyone connected today — including a
    // sub-user who connected before their office existed — keeps their own
    // destination. Reversing it would silently reroute live customers' contacts.
    const ownCheck = body.indexOf("capturedByUserId");
    const officeCheck = body.indexOf("resolveOfficeContext");
    expect(ownCheck).toBeGreaterThan(-1);
    expect(officeCheck).toBeGreaterThan(-1);
    expect(ownCheck).toBeLessThan(officeCheck);
  });

  it("only a SUB-USER inherits, never the owner or a solo account", () => {
    expect(body).toMatch(/!ctx\.isOwner/);
  });

  it("presence is checked, not health — a broken connection must not reroute", () => {
    // getCrmConnection returns null both for "no connection" and "connection
    // broken". Falling back on the broken case would silently redirect a
    // sub-user's contacts into the agency CRM instead of reporting the fault.
    // Selecting just the id keeps this a presence test.
    expect(body).toMatch(/\.select\("id"\)/);
  });
});

describe("integrations are re-checked against the plan at send time", () => {
  // A stored token or webhook URL survives a downgrade. dispatchCrmEvent
  // already re-checked isPaidPlan before firing view/notification events; the
  // lead path did not — so one lapsed account could still be syncing leads to
  // HubSpot while its other events had already stopped.
  const src = stripComments(read("src/app/api/leads/route.ts"));

  it("every CRM sync happens only for a paid owner", () => {
    // Walks back to the ENCLOSING `if` rather than looking a fixed number of
    // characters behind. The character-window version broke the moment a
    // comment was added between the gate and the call — a false failure that
    // says nothing about the gate, which is the worst kind of test.
    const at = src.indexOf("syncLeadToGoogle(");
    expect(at).toBeGreaterThan(-1);
    const openIf = src.lastIndexOf("if (", at);
    expect(openIf).toBeGreaterThan(-1);
    expect(src.slice(openIf, at)).toMatch(/isPaidPlan\(ownerProfile\.plan\)/);
  });

  it("the CRM syncs survive the response — they aren't floating promises", () => {
    // Unawaited fetches can be killed when a serverless function freezes after
    // responding, so the sync would never run and (before sync_error) would
    // have looked like silence. after() keeps the invocation alive without
    // making the visitor wait. allSettled so one dead provider can't cancel
    // the rest.
    expect(src).toMatch(/after\(\s*Promise\.allSettled\(/);
    expect(src).toContain('from "next/server"');
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
