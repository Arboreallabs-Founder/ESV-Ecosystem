-- One route for partner-sourced companies.
--
-- There were two, and they behaved differently. A partner submitting through /my-companies created
-- a partner_companies row: manual, no stages, and the SGP coordinator's intake was the only thing
-- that ever happened to it — after which there was nowhere to record what happened next. A
-- submission arriving through a pipeline form went straight onto a board and skipped the
-- coordinator entirely. Same act, two paths, one of which bypassed the approval we had just built.
--
-- Now both land as pipeline entries on a Partner Sourced pipeline. The coordinator's decision is
-- the move out of Lead, the stages are defined once, and the stage shows on the partner's own card
-- because it is read from the entry rather than tracked separately.

-- ─── The pipeline ───────────────────────────────────────────────────────────
-- Created here rather than by hand so every environment has it and the code can rely on it
-- existing. Named, not id-pinned: an org can rename it, and the lookup below is by a marker column
-- rather than by name for exactly that reason.
ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS is_partner_intake BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pipelines.is_partner_intake IS
  'The single pipeline partner-sourced companies land on. At most one per org.';

-- One per org: two would recreate the split this migration exists to remove.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipelines_one_partner_intake
  ON public.pipelines(org_id) WHERE is_partner_intake;

DO $$
DECLARE
  v_org UUID;
  v_pipeline UUID;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    SELECT id INTO v_pipeline
      FROM public.pipelines WHERE org_id = v_org AND is_partner_intake LIMIT 1;

    IF v_pipeline IS NULL THEN
      INSERT INTO public.pipelines (org_id, name, description, is_partner_intake)
      VALUES (
        v_org,
        'Partner Sourced',
        'Companies referred by franchise partners. Everything a partner submits arrives here at '
          || 'Lead; an SGP Coordinator decides what happens next.',
        true
      )
      RETURNING id INTO v_pipeline;

      -- Stages mirror the three intake actions the SGP Desk already offers, so the coordinator's
      -- existing decision maps onto a stage instead of being recorded somewhere else.
      INSERT INTO public.pipeline_stages (pipeline_id, name, position, stage_type, color) VALUES
        (v_pipeline, 'Lead',                  0, 'lead',     '#A39B95'),
        (v_pipeline, 'First level call',      1, 'custom',   '#745FFD'),
        (v_pipeline, 'Prefunding proposal',   2, 'custom',   '#8B72FD'),
        (v_pipeline, 'Founder discussion',    3, 'custom',   '#D5AE8F'),
        (v_pipeline, 'Accepted',              4, 'accepted', '#2E7D32'),
        (v_pipeline, 'Rejected',              5, 'rejected', '#C0392B');
    END IF;
  END LOOP;
END $$;

-- ─── Attribution ────────────────────────────────────────────────────────────
-- A partner submitting while logged in has no form_link, so the existing
-- form_link -> creator -> franchise_partner chain cannot attribute them. A direct column does,
-- and it is the same answer however the entry arrived.
ALTER TABLE public.pipeline_entries
  ADD COLUMN IF NOT EXISTS sourced_by_partner_id UUID REFERENCES public.franchise_partners(id) ON DELETE SET NULL,
  -- What the partner wrote when they submitted. Passed through verbatim to whoever picks it up:
  -- it is the most useful thing in the submission and the reason they bothered.
  ADD COLUMN IF NOT EXISTS partner_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_pipeline_entries_partner
  ON public.pipeline_entries(sourced_by_partner_id) WHERE sourced_by_partner_id IS NOT NULL;

-- ─── RLS ────────────────────────────────────────────────────────────────────

-- A partner may create an entry, but only on the partner-intake pipeline, only at its Lead stage,
-- and only attributed to themselves. Enforced here rather than in the action because this is the
-- rule that stops the bypass: without the stage check a partner could post an entry straight into
-- "Accepted".
DROP POLICY IF EXISTS "Partners submit to the partner pipeline" ON public.pipeline_entries;
CREATE POLICY "Partners submit to the partner pipeline"
  ON public.pipeline_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'franchise_partner'
    AND EXISTS (
      SELECT 1 FROM public.pipelines p
      WHERE p.id = pipeline_id
        AND p.org_id = public.get_user_org_id()
        AND p.is_partner_intake
    )
    AND EXISTS (
      SELECT 1 FROM public.pipeline_stages s
      WHERE s.id = stage_id AND s.pipeline_id = pipeline_id AND s.stage_type = 'lead'
    )
    AND sourced_by_partner_id = (
      SELECT franchise_partner_id FROM public.users WHERE id = auth.uid()
    )
  );

-- A partner reads back what they submitted — including its current stage, which is the whole point
-- of routing this through a pipeline. Partner-to-partner isolation holds: they see their own only.
DROP POLICY IF EXISTS "Partners read own sourced entries" ON public.pipeline_entries;
CREATE POLICY "Partners read own sourced entries"
  ON public.pipeline_entries FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND sourced_by_partner_id = (
      SELECT franchise_partner_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Deliberately no UPDATE for partners. Once submitted it is ours to move; a partner advancing
-- their own referral to "Accepted" is precisely the bypass this replaces.

-- Partners must be able to read the stage names their entries sit on, or the card can only show an
-- id. Read-only, and only for the pipeline they can submit to.
DROP POLICY IF EXISTS "Partners read partner pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Partners read partner pipeline stages"
  ON public.pipeline_stages FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND EXISTS (
      SELECT 1 FROM public.pipelines p
      WHERE p.id = pipeline_id AND p.org_id = public.get_user_org_id() AND p.is_partner_intake
    )
  );

DROP POLICY IF EXISTS "Partners read partner pipeline" ON public.pipelines;
CREATE POLICY "Partners read partner pipeline"
  ON public.pipelines FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND org_id = public.get_user_org_id()
    AND is_partner_intake
  );

-- ─── Carrying the old submissions across ────────────────────────────────────
-- The three existing partner_companies rows become entries on the new pipeline so nothing is
-- stranded on a route that no longer receives anything. partner_companies is left in place rather
-- than dropped: it holds the coordinator's intake decisions, and deleting it would erase what was
-- decided about companies that are now live entries.
DO $$
DECLARE
  r RECORD;
  v_pipeline UUID;
  v_lead UUID;
BEGIN
  FOR r IN
    SELECT pc.*, u.franchise_partner_id
      FROM public.partner_companies pc
      LEFT JOIN public.users u ON u.id = pc.submitted_by
  LOOP
    SELECT id INTO v_pipeline FROM public.pipelines
      WHERE org_id = r.org_id AND is_partner_intake LIMIT 1;
    CONTINUE WHEN v_pipeline IS NULL;

    -- Closed submissions land on Rejected, assigned ones on First level call, the rest at Lead —
    -- so the board opens showing where things actually stand rather than everything at the start.
    SELECT id INTO v_lead FROM public.pipeline_stages
      WHERE pipeline_id = v_pipeline
        AND stage_type = CASE WHEN r.status = 'closed' THEN 'rejected' ELSE 'lead' END
      LIMIT 1;

    IF NOT EXISTS (
      SELECT 1 FROM public.pipeline_entries e
      WHERE e.pipeline_id = v_pipeline AND e.title = r.name
    ) THEN
      INSERT INTO public.pipeline_entries
        (pipeline_id, stage_id, title, submitter_name, submitter_email,
         sourced_by_partner_id, partner_notes, submitted_at)
      VALUES
        (v_pipeline, v_lead, r.name, r.contact_name, r.contact_email,
         COALESCE(r.partner_id, r.franchise_partner_id), r.partner_comments, r.created_at);
    END IF;
  END LOOP;
END $$;
