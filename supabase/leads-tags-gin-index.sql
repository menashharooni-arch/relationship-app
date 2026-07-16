-- getOfficeLeads() (src/lib/office-leads.ts) filters departed-member leads with
-- .contains("tags", [officeLeadTag]) — a Postgres array @> containment
-- predicate, which can only use a GIN index. Every existing leads index is
-- btree (card_owner/created_at/name/stage), so this query is a full
-- sequential scan on every Office admin Leads page load and "needs
-- attention" check (performance audit). Run once in the Supabase SQL
-- Editor. IF NOT EXISTS, safe to re-run.
CREATE INDEX IF NOT EXISTS idx_leads_tags_gin ON public.leads USING gin (tags);
