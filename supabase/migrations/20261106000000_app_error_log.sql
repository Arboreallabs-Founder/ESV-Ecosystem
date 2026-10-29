-- An error log for troubleshooting (decided 2026-10-29).
--
-- Error codes such as "(code 42501)" are now shown to admins only. Everyone else gets the same
-- sentence without the code, so when somebody hits one there has to be somewhere an admin can see
-- what actually happened. Every database failure an action reports (dbFailure) is written here
-- with who, on which page, which step, the SQLSTATE and the database's own message — the detail
-- that is deliberately never shown to the person who hit it, because it can name tables and columns.
--
-- Read by admins only (Admin > Activity Log > Errors). Written only through log_app_error(), which
-- records the caller itself, so nobody can file an error as someone else.

CREATE TABLE IF NOT EXISTS public.app_error_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name   TEXT,
  user_role   TEXT,
  step        TEXT NOT NULL,       -- what the app was doing: "save that", "create the project"
  code        TEXT,                -- SQLSTATE, e.g. 42501
  message     TEXT,                -- the database's message
  details     TEXT,
  hint        TEXT,
  page        TEXT,                -- the page the action was called from
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_error_log_org_time ON public.app_error_log(org_id, created_at DESC);

ALTER TABLE public.app_error_log ENABLE ROW LEVEL SECURITY;

-- Admins (and the platform super admin) read; nobody writes directly.
DROP POLICY IF EXISTS "Admins read the error log" ON public.app_error_log;
CREATE POLICY "Admins read the error log"
  ON public.app_error_log FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() = 'admin')
  );

CREATE OR REPLACE FUNCTION public.log_app_error(
  p_step TEXT, p_code TEXT, p_message TEXT, p_details TEXT, p_hint TEXT, p_page TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
  v_org  UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  -- A double-click or a retry loop shouldn't fill the log with copies of one failure.
  IF EXISTS (
    SELECT 1 FROM public.app_error_log
     WHERE user_id = auth.uid() AND step = left(p_step, 200) AND code IS NOT DISTINCT FROM p_code
       AND created_at > NOW() - INTERVAL '10 seconds'
  ) THEN
    RETURN;
  END IF;

  SELECT name, role::TEXT, org_id INTO v_name, v_role, v_org FROM public.users WHERE id = auth.uid();

  INSERT INTO public.app_error_log (org_id, user_id, user_name, user_role, step, code, message, details, hint, page)
  VALUES (v_org, auth.uid(), v_name, v_role,
          left(coalesce(p_step, 'unknown step'), 200), left(p_code, 10),
          left(p_message, 2000), left(p_details, 2000), left(p_hint, 1000), left(p_page, 500));
END $$;

REVOKE ALL ON FUNCTION public.log_app_error(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_app_error(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
