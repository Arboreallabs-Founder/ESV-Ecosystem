-- Audit trail for investor-record edits, now that associates can edit investor details too
-- (not just founder/admin). A plain append-only log — founder/admin can review it as a
-- timestamped "notepad" list (rendered/exported as text in the app; nothing is written to
-- disk server-side, since Vercel's filesystem is ephemeral and wouldn't persist a real file).
CREATE TABLE IF NOT EXISTS public.investor_edit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id    UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  org_id         UUID NOT NULL REFERENCES public.organizations(id),
  edited_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  edited_by_name TEXT,
  investor_name  TEXT NOT NULL,
  changes        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS investor_edit_log_org_idx ON public.investor_edit_log(org_id, created_at DESC);

ALTER TABLE public.investor_edit_log ENABLE ROW LEVEL SECURITY;

-- Founder/admin can review the log; founder/admin/associate can write to it (whoever can
-- actually edit an investor record needs to be able to log that edit).
DROP POLICY IF EXISTS "Admins read investor edit log" ON public.investor_edit_log;
CREATE POLICY "Admins read investor edit log" ON public.investor_edit_log
  FOR SELECT TO authenticated
  USING (is_super_admin() OR (org_id = get_user_org_id() AND get_user_role() IN ('founder', 'admin')));

DROP POLICY IF EXISTS "Internal write investor edit log" ON public.investor_edit_log;
CREATE POLICY "Internal write investor edit log" ON public.investor_edit_log
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND get_user_role() IN ('founder', 'admin', 'associate'));
