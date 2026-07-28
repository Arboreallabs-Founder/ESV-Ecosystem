-- Performance analytics: a composite score per internal user, built from signals the app already
-- records (kudos received, task punctuality, recurring-duty adherence, event attendance) plus
-- manual adjustments for things the data can't see.
--
-- Two deliberate design decisions encoded here:
--  1. Weights live in a table, not in code — the scoring formula is a judgement call the org owns
--     and can change, not a constant baked into a deploy.
--  2. Leave is NOT a signal. Approved leave is an entitlement, and scoring it negatively pushes
--     people to work while ill. Attendance concerns belong in performance_adjustments, where they
--     carry an author and a written reason.

-- ─── performance_weights (per-org singleton) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.performance_weights (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL UNIQUE REFERENCES public.organizations(id),
  kudos_received      NUMERIC NOT NULL DEFAULT 5,
  task_on_time        NUMERIC NOT NULL DEFAULT 2,
  task_overdue        NUMERIC NOT NULL DEFAULT -3,
  task_pushed         NUMERIC NOT NULL DEFAULT -1,
  recurring_completed NUMERIC NOT NULL DEFAULT 1,
  event_attended      NUMERIC NOT NULL DEFAULT 1,
  updated_by          UUID REFERENCES public.users(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuses the set_updated_at() helper from 20260713100000_companies.sql.
DROP TRIGGER IF EXISTS performance_weights_set_updated_at ON public.performance_weights;
CREATE TRIGGER performance_weights_set_updated_at
  BEFORE UPDATE ON public.performance_weights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults for every existing org so the dashboard never has a "no weights yet" state.
INSERT INTO public.performance_weights (org_id)
SELECT id FROM public.organizations
ON CONFLICT (org_id) DO NOTHING;

ALTER TABLE public.performance_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal view performance weights" ON public.performance_weights;
CREATE POLICY "Internal view performance weights"
  ON public.performance_weights FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate', 'general', 'hr')));

-- Only founder/admin set the formula. HR can read it and can make adjustments, but does not get
-- to change how everyone's score is calculated.
DROP POLICY IF EXISTS "Admins insert performance weights" ON public.performance_weights;
CREATE POLICY "Admins insert performance weights"
  ON public.performance_weights FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'));

DROP POLICY IF EXISTS "Admins update performance weights" ON public.performance_weights;
CREATE POLICY "Admins update performance weights"
  ON public.performance_weights FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'));

-- ─── performance_adjustments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.performance_adjustments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id),
  user_id     UUID NOT NULL REFERENCES public.users(id),
  points      NUMERIC NOT NULL,
  reason      TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by  UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_adjustments_org ON public.performance_adjustments(org_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_perf_adjustments_user ON public.performance_adjustments(user_id);

ALTER TABLE public.performance_adjustments ENABLE ROW LEVEL SECURITY;

-- You can always see adjustments recorded about you, including the reason — a scoring system that
-- lets people be marked down without being able to see why isn't defensible.
DROP POLICY IF EXISTS "Performance adjustments select" ON public.performance_adjustments;
CREATE POLICY "Performance adjustments select"
  ON public.performance_adjustments FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND (public.get_user_role() IN ('founder', 'admin', 'hr') OR user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Performance adjustments insert" ON public.performance_adjustments;
CREATE POLICY "Performance adjustments insert"
  ON public.performance_adjustments FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr') AND created_by = auth.uid());

DROP POLICY IF EXISTS "Performance adjustments update" ON public.performance_adjustments;
CREATE POLICY "Performance adjustments update"
  ON public.performance_adjustments FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));

DROP POLICY IF EXISTS "Performance adjustments delete" ON public.performance_adjustments;
CREATE POLICY "Performance adjustments delete"
  ON public.performance_adjustments FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));
