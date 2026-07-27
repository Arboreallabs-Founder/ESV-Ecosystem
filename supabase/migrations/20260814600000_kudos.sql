-- Kudos: peer recognition feed for the new Engage area. Internal roles only (no SGP), public
-- feed to everyone who can give/receive, immutable once given (no edit, matches escalations
-- having no body-edit either — only a status/lifecycle change is possible there).

CREATE TABLE IF NOT EXISTS public.kudos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id),
  giver_id     UUID NOT NULL REFERENCES public.users(id),
  recipient_id UUID NOT NULL REFERENCES public.users(id),
  message      TEXT NOT NULL CHECK (char_length(message) <= 500),
  category     TEXT CHECK (category IS NULL OR category IN
                 ('Teamwork', 'Leadership', 'Innovation', 'Above & Beyond', 'Customer Focus', 'Other')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (giver_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_kudos_org ON public.kudos(org_id, created_at DESC);

ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal view kudos" ON public.kudos;
CREATE POLICY "Internal view kudos"
  ON public.kudos FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')));

DROP POLICY IF EXISTS "Internal give kudos" ON public.kudos;
CREATE POLICY "Internal give kudos"
  ON public.kudos FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')
    AND giver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = recipient_id AND u.org_id = public.get_user_org_id()
        AND u.role IN ('founder', 'admin', 'associate', 'general', 'hr')
    )
  );

DROP POLICY IF EXISTS "Kudos delete" ON public.kudos;
CREATE POLICY "Kudos delete"
  ON public.kudos FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      org_id = public.get_user_org_id()
      AND (public.get_user_role() IN ('founder', 'admin', 'hr') OR giver_id = auth.uid())
    )
  );
