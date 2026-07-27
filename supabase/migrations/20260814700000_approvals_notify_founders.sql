-- Founder-notify-on-approval reuses the escalations table (this app's only "notify a specific
-- person" precedent, already surfaced via /escalations and the dashboard's open-count) rather
-- than a new notifications table. When an admin or hr approves a leave/expense request, one
-- escalation row per founder is inserted (recipient_user_id is a single FK, so "notify all
-- founders" means one row each) — see src/lib/notify-founders.ts.

-- linked_type is an inline, unnamed column CHECK on escalations(linked_type) — Postgres
-- deterministically names a single unnamed column CHECK "<table>_<column>_check".
ALTER TABLE public.escalations DROP CONSTRAINT IF EXISTS escalations_linked_type_check;
ALTER TABLE public.escalations ADD CONSTRAINT escalations_linked_type_check
  CHECK (linked_type IN ('active_deal', 'pipeline_entry', 'task', 'investor', 'leave_request', 'expense_request'));

-- 'admin' can already insert; 'hr' needs to be added so an HR approver's own session can insert
-- the auto-notify rows (raised_by = the approving hr user, WITH CHECK requires raised_by = self).
DROP POLICY IF EXISTS "Escalations insert" ON public.escalations;
CREATE POLICY "Escalations insert" ON public.escalations
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('associate', 'admin', 'hr')
    AND raised_by = auth.uid()
  );
