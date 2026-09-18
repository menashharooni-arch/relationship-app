import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Warm-lead plan PR A3. The migration's privacy and deletion choices are
// product decisions (D7, D8), so they are pinned here rather than trusted to
// survive an edit.
const sql = readFileSync(join(process.cwd(), "supabase/warm-lead-alerts.sql"), "utf8");

describe("warm-lead schema", () => {
  it("keeps both new tables service-role only (RLS on, no policies)", () => {
    expect(sql).toMatch(/ALTER TABLE public\.contact_links ENABLE ROW LEVEL SECURITY;/);
    expect(sql).toMatch(/ALTER TABLE public\.contact_devices ENABLE ROW LEVEL SECURITY;/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it("binds a browser to a lead at most once, and records how it was earned", () => {
    expect(sql).toMatch(/UNIQUE \(lead_id, visitor_id\)/);
    expect(sql).toMatch(/bound_via IN \('form', 'link', 'account'\)/);
  });

  it("records which browser a link binding was, so a forwarded link is never named (D3)", () => {
    expect(sql).toMatch(/link_device_index smallint/);
  });

  it("a deleted contact's visits become anonymous, not deleted", () => {
    expect(sql).toMatch(/card_events ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public\.leads\(id\) ON DELETE SET NULL/);
    expect(sql).toMatch(/card_views ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public\.leads\(id\) ON DELETE SET NULL/);
  });

  it("a deleted contact's notifications are deleted with them (D8)", () => {
    expect(sql).toMatch(/notifications ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public\.leads\(id\) ON DELETE CASCADE/);
  });

  it("bindings and links go when the lead goes", () => {
    const cascades = sql.match(/lead_id\s+uuid NOT NULL REFERENCES public\.leads\(id\) ON DELETE CASCADE/g) ?? [];
    expect(cascades).toHaveLength(2);
  });

  it("a push records which contact it was about, for the per-contact cap (D4)", () => {
    expect(sql).toMatch(/push_log ADD COLUMN IF NOT EXISTS lead_id uuid/);
  });

  it("is safe to re-run", () => {
    expect(sql).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(sql).not.toMatch(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/);
    expect(sql).toMatch(/ON CONFLICT \(lead_id, visitor_id\) DO NOTHING/);
  });
});
