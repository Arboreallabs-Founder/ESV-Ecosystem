-- A shareable form for associates, the same shape as the partner form (20260906000000 /
-- 20260907000000): one dedicated pipeline, one dedicated form pointed at it, a link an associate
-- can hand to a founder, and a public submission that comes back attributed to whoever shared it.
--
-- Not merged into Deal Desk. Deal Desk's quick-add (createDeskDeal) already covers "an associate
-- types in a company they heard about"; this is the other half — a link an associate SENDS so the
-- company can submit themselves — and that needs an anonymous-submission path. Building that from
-- scratch on desk_deals would duplicate the pipelines/forms/`/f/[token]` machinery that already
-- does exactly this; reusing it is strictly less work and gets review-on-a-Kanban-board for free.

-- ─── The pipeline ───────────────────────────────────────────────────────────
ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS is_associate_intake BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pipelines.is_associate_intake IS
  'The single pipeline associate-sourced companies land on. At most one per org.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipelines_one_associate_intake
  ON public.pipelines(org_id) WHERE is_associate_intake;

DO $$
DECLARE
  v_org UUID;
  v_pipeline UUID;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    SELECT id INTO v_pipeline
      FROM public.pipelines WHERE org_id = v_org AND is_associate_intake LIMIT 1;

    IF v_pipeline IS NULL THEN
      INSERT INTO public.pipelines (org_id, name, description, is_associate_intake)
      VALUES (
        v_org,
        'Associate Sourced',
        'Companies an associate referred here, or that submitted through an associate''s link. '
          || 'Everything arrives at Lead, credited to whoever shared it.',
        true
      )
      RETURNING id INTO v_pipeline;

      -- No coordinator-triage stages like the partner pipeline has — the associate who sourced it
      -- already owns the follow-up, so the three mandatory stages are enough.
      INSERT INTO public.pipeline_stages (pipeline_id, name, position, stage_type, color) VALUES
        (v_pipeline, 'Lead',      0, 'lead',     '#A39B95'),
        (v_pipeline, 'Accepted',  1, 'accepted', '#2E7D32'),
        (v_pipeline, 'Rejected',  2, 'rejected', '#C0392B');
    END IF;
  END LOOP;
END $$;

-- ─── Attribution ─────────────────────────────────────────────────────────────
-- Same reasoning as sourced_by_partner_id: a direct column, because it must hold however the entry
-- arrived (not just through a link).
ALTER TABLE public.pipeline_entries
  ADD COLUMN IF NOT EXISTS sourced_by_associate_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_entries_associate
  ON public.pipeline_entries(sourced_by_associate_id) WHERE sourced_by_associate_id IS NOT NULL;

-- Generalises attribute_entry_to_partner() into one function that credits whichever kind of
-- sourcer created the link: a franchise partner gets sourced_by_partner_id (unchanged behaviour),
-- anyone else (founder/admin/associate/general/hr — nobody without a franchise_partner_id) gets
-- sourced_by_associate_id. One lookup either way, so this replaces the old trigger rather than
-- running alongside it.
CREATE OR REPLACE FUNCTION public.attribute_entry_to_sourcer() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id UUID;
  v_creator_id UUID;
BEGIN
  IF NEW.form_link_id IS NOT NULL
     AND NEW.sourced_by_partner_id IS NULL
     AND NEW.sourced_by_associate_id IS NULL
  THEN
    SELECT u.franchise_partner_id, u.id INTO v_partner_id, v_creator_id
      FROM public.form_links fl
      JOIN public.users u ON u.id = fl.created_by
     WHERE fl.id = NEW.form_link_id;

    IF v_partner_id IS NOT NULL THEN
      NEW.sourced_by_partner_id := v_partner_id;
    ELSIF v_creator_id IS NOT NULL THEN
      NEW.sourced_by_associate_id := v_creator_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pipeline_entries_attribute_partner ON public.pipeline_entries;
DROP TRIGGER IF EXISTS pipeline_entries_attribute_sourcer ON public.pipeline_entries;
CREATE TRIGGER pipeline_entries_attribute_sourcer
  BEFORE INSERT ON public.pipeline_entries
  FOR EACH ROW EXECUTE FUNCTION public.attribute_entry_to_sourcer();

-- An associate (or founder/admin/general/hr — anyone whose link this could be) reads back their own
-- sourced entries regardless of assignment, same as a partner does today. Without this, a fresh
-- unassigned submission is invisible to the person who brought it in until someone else assigns it.
DROP POLICY IF EXISTS "Sourcing user reads own sourced entries" ON public.pipeline_entries;
CREATE POLICY "Sourcing user reads own sourced entries"
  ON public.pipeline_entries FOR SELECT TO authenticated
  USING (sourced_by_associate_id = auth.uid());

-- ─── The form ────────────────────────────────────────────────────────────────
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS is_associate_form BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.forms.is_associate_form IS
  'The form associates issue links from. One per org; always feeds the associate-intake pipeline.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_one_associate_form
  ON public.forms(org_id) WHERE is_associate_form;

DO $$
DECLARE
  v_org UUID;
  v_pipeline UUID;
  v_form UUID;
  v_start UUID; v_name UUID; v_web UUID; v_sector UUID; v_contact UUID; v_why UUID; v_end UUID;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.forms WHERE org_id = v_org AND is_associate_form);

    SELECT id INTO v_pipeline FROM public.pipelines
      WHERE org_id = v_org AND is_associate_intake LIMIT 1;
    CONTINUE WHEN v_pipeline IS NULL;

    INSERT INTO public.forms (org_id, title, description, pipeline_id, published, is_associate_form)
    VALUES (
      v_org,
      'Associate Referral',
      'Share this with a founder you want to introduce. Their answers land on the Associate '
        || 'Sourced pipeline at Lead, credited to you.',
      v_pipeline, true, true
    )
    RETURNING id INTO v_form;

    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'start', NULL, '', 0, 0) RETURNING id INTO v_start;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'Company name', 0, 150) RETURNING id INTO v_name;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'Website or LinkedIn', 0, 300) RETURNING id INTO v_web;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'What sector are they in?', 0, 450) RETURNING id INTO v_sector;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'short_text', 'Who is the contact, and how do we reach them?', 0, 600) RETURNING id INTO v_contact;
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'long_text', 'Anything we should know before we reach out?', 0, 750) RETURNING id INTO v_why;
    INSERT INTO public.form_nodes (form_id, type, subtype, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'end', 'success', NULL, '', 0, 900) RETURNING id INTO v_end;

    INSERT INTO public.form_edges (form_id, source_node_id, target_node_id) VALUES
      (v_form, v_start, v_name), (v_form, v_name, v_web), (v_form, v_web, v_sector),
      (v_form, v_sector, v_contact), (v_form, v_contact, v_why), (v_form, v_why, v_end);
  END LOOP;
END $$;

-- The form cannot be pointed at another pipeline, same guard the partner form has — otherwise an
-- edit silently redirects every associate's existing links to whatever the form now feeds.
CREATE OR REPLACE FUNCTION public.associate_form_pipeline_check() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_associate_form THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pipelines p
      WHERE p.id = NEW.pipeline_id AND p.is_associate_intake
    ) THEN
      RAISE EXCEPTION 'The associate form must feed the associate-intake pipeline.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS forms_associate_pipeline ON public.forms;
CREATE TRIGGER forms_associate_pipeline
  BEFORE INSERT OR UPDATE OF is_associate_form, pipeline_id ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.associate_form_pipeline_check();

-- No new form_links or forms SELECT/INSERT policies needed: "Org internal form links access"
-- (20260924000000) already lets founder/admin/associate create and read links on any form in their
-- org, and forms are already readable by those same roles — this form is just another row to them.
