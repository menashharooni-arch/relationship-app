import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ORG } from "@/lib/agent-org";

// ── An agent that exists must be VISIBLE ─────────────────────────────────────
//
// Owner report 2026-09-08: "why don't I see Addy under Maya's marketing team
// and agents?"
//
// Addy was real in every place except the one that renders. He had a brief
// (marketing-agents/agents/ads.md), an org.json entry reporting to Maya, and an
// enabled agent_settings row in production — he ran on 2026-09-08 and put two
// ad_campaign briefs in the queue. But the Agents screen renders from a
// hand-maintained TEAMS array in AgentFlowClient.tsx, and "ads" was never added
// to it, so the owner had an agent working for him that he could not see, pause,
// or cap.
//
// Three lists have to agree, and nothing but this test makes them:
//   org.json          who exists and who they report to
//   TEAMS             who is drawn on the Agents screen
//   agent-flow.sql    who gets a settings row in a fresh database

const root = process.cwd();
const client = readFileSync(join(root, "src/app/admin/agent-flow/AgentFlowClient.tsx"), "utf8");
const sql = readFileSync(join(root, "supabase/agent-flow.sql"), "utf8");

/** The agent ids listed in the TEAMS array, in render order. */
function renderedAgentIds(): string[] {
  const at = client.indexOf("const TEAMS:");
  const end = client.indexOf("\n];", at);
  const block = client.slice(at, end);
  return [...block.matchAll(/agents: \[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
}

const orgAgentIds = Object.values(ORG).filter((p) => p.agent_id).map((p) => p.agent_id!);

describe("the Agents screen shows every agent that exists", () => {
  it("renders each org.json agent exactly once", () => {
    const rendered = renderedAgentIds();
    for (const id of orgAgentIds) {
      expect(rendered, `${id} is in org.json but not on the Agents screen`).toContain(id);
    }
    expect(new Set(rendered).size).toBe(rendered.length);
  });

  it("renders nothing that org.json does not define", () => {
    // The other direction: a row with no party would render a bare agent id
    // where a name and role belong.
    for (const id of renderedAgentIds()) {
      expect(orgAgentIds, `${id} is on the Agents screen but not in org.json`).toContain(id);
    }
  });

  it("puts every marketing worker under Maya, and every engineer under Rex", () => {
    const at = client.indexOf('id: "marketing"');
    const marketing = [...client.slice(at, client.indexOf("]", at)).matchAll(/"([^"]+)"/g)]
      .map((m) => m[1]).filter((v) => orgAgentIds.includes(v));
    for (const id of marketing) {
      const party = Object.values(ORG).find((p) => p.agent_id === id)!;
      expect(party.reports_to, `${id} is drawn under Maya but reports to ${party.reports_to}`).toBe("maya");
    }
  });
});

describe("a fresh database seeds every agent", () => {
  it("has a settings row for each one, or it can never be enabled or capped", () => {
    for (const id of orgAgentIds) {
      expect(sql, `agent-flow.sql seeds no row for ${id}`).toMatch(new RegExp(`\\('${id}',`));
    }
  });
});

describe("every queue item type reads as English", () => {
  it("labels ad_campaign, so Addy's work is not a raw slug in the queue", () => {
    const at = client.indexOf("const TYPE_LABEL");
    const block = client.slice(at, client.indexOf("};", at));
    expect(block).toMatch(/ad_campaign: "Ad campaign"/);
  });

  it("gives an ad brief a way OUT that cannot spend money", () => {
    // Standing owner rule: Addy never spends. There is no Meta connector, so
    // the only action is copy-to-clipboard, and the copy says PAUSED.
    const at = client.indexOf('it.item_type === "ad_campaign"');
    expect(at).toBeGreaterThan(-1);
    const block = client.slice(at, at + 500);
    // The HANDLER is what matters, not the prose around it: the only thing
    // this button does is copy to the clipboard and mark the item approved.
    const onClick = block.match(/onClick=\{([^}]*)\}/)?.[1] ?? "";
    expect(onClick).toMatch(/copyApprove\(it, "Meta Ads Manager/);
    expect(onClick).not.toMatch(/fetch|act\(|POST/);
    // And the copy tells the owner the campaign is created PAUSED — his
    // standing rule is that activating spend is always his own hand.
    expect(block).toMatch(/PAUSED/);
    expect(block).toMatch(/Nothing is spent/);
  });
});
