-- Partner-sourced company intake.
--
-- The partner-side sibling of Deal Desk. A partner adds a company they have found, with their own
-- comments; an SGP Coordinator triages it, decides what should happen next, and hands it to an
-- associate or general user to act on.
--
-- Deliberately NOT rows in `companies`. A partner submission is a lead someone vouched for, not a
-- company of record — it has no cap table, no rounds, no documents, and it may be rejected. Mixing
-- the two would put unvetted entries into the database everything else treats as authoritative.
-- Promotion to a real company happens at intake, the same way Deal Desk promotes.

DO $$ BEGIN
  CREATE TYPE sgp_intake_action AS ENUM ('first_call', 'prefunding_proposal', 'discuss_with_founder');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sgp_submission_status AS ENUM ('submitted', 'assigned', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Who coordinates ────────────────────────────────────────────────────────
-- A flag rather than a role: a coordinator is an associate who also does this. Making it a role
-- would mean choosing between their existing permissions and this one, and would need an enum
-- change every time the arrangement shifts. Several people can hold it at once.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_sgp_coordinator BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_sgp_coordinator
  ON public.users(org_id) WHERE is_sgp_coordinator;

-- ─── Submissions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_companies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id),

  submitted_by      UUID NOT NULL REFERENCES public.users(id),
  -- Denormalised from the submitter so attribution survives them leaving.
  partner_id        UUID REFERENCES public.franchise_partners(id),

  -- What the partner fills in. Only the name is required: the point is to capture a lead while
  -- it is fresh, not to make someone complete a form before they can tell us about it.
  name              TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  website           TEXT,
  sector            TEXT,
  hq_city           TEXT,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  partner_comments  TEXT,

  status            sgp_submission_status NOT NULL DEFAULT 'submitted',

  -- ─── Coordinator triage ───
  intake_action     sgp_intake_action,
  coordinator_id    UUID REFERENCES public.users(id),
  coordinator_notes TEXT,
  -- [{ "label": "...", "url": "..." }] — a handful of references per submission, so an array
  -- rather than a child table nobody would ever query independently.
  supporting_links  JSONB NOT NULL DEFAULT '[]'::jsonb,

  assigned_to       UUID REFERENCES public.users(id),
  assigned_at       TIMESTAMPTZ,
  -- The task created for the assignee, so the submission and their board stay in step.
  task_id           UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  -- Set if the coordinator promotes the submission to a company of record.
  company_id        UUID REFERENCES public.companies(id) ON DELETE SET NULL,

  closed_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_companies_org ON public.partner_companies(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_companies_submitter ON public.partner_companies(submitted_by);
CREATE INDEX IF NOT EXISTS idx_partner_companies_assignee ON public.partner_companies(assigned_to);
CREATE INDEX IF NOT EXISTS idx_partner_companies_queue
  ON public.partner_companies(org_id, created_at) WHERE status = 'submitted';

DROP TRIGGER IF EXISTS partner_companies_set_updated_at ON public.partner_companies;
CREATE TRIGGER partner_companies_set_updated_at
  BEFORE UPDATE ON public.partner_companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.partner_companies ENABLE ROW LEVEL SECURITY;

-- Read: leadership and coordinators see the whole queue; a partner sees only what they submitted;
-- an assignee sees what was handed to them. Partners must never see each other's leads — that is
-- the same rule the rest of the partner surface follows.
DROP POLICY IF EXISTS "Partner companies select" ON public.partner_companies;
CREATE POLICY "Partner companies select" ON public.partner_companies
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR submitted_by = auth.uid()
    OR assigned_to = auth.uid()
    OR (
      org_id = public.get_user_org_id()
      AND (
        public.get_user_role() IN ('founder', 'admin')
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid() AND u.is_sgp_coordinator
        )
      )
    )
  );

-- Partners submit their own; internal staff can log one on a partner's behalf.
DROP POLICY IF EXISTS "Partner companies insert" ON public.partner_companies;
CREATE POLICY "Partner companies insert" ON public.partner_companies
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND submitted_by = auth.uid()
    AND public.get_user_role() IN ('franchise_partner', 'founder', 'admin', 'associate')
  );

-- Triage is for coordinators and leadership. A partner cannot edit a submission once it is in —
-- the coordinator is acting on what was said at the time, and letting it change underneath them
-- would make the queue untrustworthy.
DROP POLICY IF EXISTS "Partner companies update" ON public.partner_companies;
CREATE POLICY "Partner companies update" ON public.partner_companies
  FOR UPDATE TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND (
      public.get_user_role() IN ('founder', 'admin')
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_sgp_coordinator)
    )
  )
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND (
      public.get_user_role() IN ('founder', 'admin')
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_sgp_coordinator)
    )
  );

-- No DELETE policy. A submission a partner made is a record of what they brought in, which is how
-- their contribution is evidenced — closing it with a reason is the way to end it.
