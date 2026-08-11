-- One form for partners, and it is the only one they can hand out.
--
-- Partners could issue a link to any published form, and each form feeds its own pipeline. So a
-- partner-sourced company could land on Series A Intake or Deal Pipeline, skipping the SGP
-- coordinator entirely — the bypass the previous migration only half closed, because it fixed the
-- logged-in route and left the link route alone.
--
-- Now: one partner form, pointed at the Partner Sourced pipeline, editable in the builder like any
-- other. Partners issue links from it and nothing else, so every referral arrives at Lead in front
-- of a coordinator however it was submitted.

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS is_partner_form BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.forms.is_partner_form IS
  'The single form partners may issue links from. One per org; always feeds the partner-intake pipeline.';

-- One per org. Two would be two front doors again, which is the thing being removed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_one_partner_form
  ON public.forms(org_id) WHERE is_partner_form;

-- ─── Build it ───────────────────────────────────────────────────────────────
-- Created here so every environment has one and the code can rely on it. The questions are a
-- starting point, not a fixture: it opens in the normal builder and is meant to be edited.
DO $$
DECLARE
  v_org UUID;
  v_pipeline UUID;
  v_form UUID;
  v_start UUID; v_name UUID; v_web UUID; v_sector UUID; v_contact UUID;
  v_why UUID; v_stage UUID; v_end UUID;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.forms WHERE org_id = v_org AND is_partner_form);

    SELECT id INTO v_pipeline FROM public.pipelines
      WHERE org_id = v_org AND is_partner_intake LIMIT 1;
    CONTINUE WHEN v_pipeline IS NULL;   -- 20260906 must run first

    INSERT INTO public.forms (org_id, title, description, pipeline_id, published, is_partner_form)
    VALUES (
      v_org,
      'Partner Referral',
      'The form every franchise partner uses. Submissions arrive on the Partner Sourced pipeline '
        || 'at Lead for an SGP Coordinator to triage.',
      v_pipeline, true, true
    )
    RETURNING id INTO v_form;

    -- Deliberately short. A partner is passing on a lead, not filing a diligence pack, and every
    -- extra question is a reason not to bother — which costs us the referral entirely.
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
      VALUES (v_form, 'question', 'short_text', 'Roughly what are they raising?', 0, 750) RETURNING id INTO v_stage;
    -- The question that earns its place: this is the part a coordinator actually reads.
    INSERT INTO public.form_nodes (form_id, type, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'question', 'long_text', 'Why is this worth our time? Anything you know that we would not find ourselves.', 0, 900) RETURNING id INTO v_why;
    INSERT INTO public.form_nodes (form_id, type, subtype, answer_type, question_text, position_x, position_y)
      VALUES (v_form, 'end', 'success', NULL, '', 0, 1050) RETURNING id INTO v_end;

    INSERT INTO public.form_edges (form_id, source_node_id, target_node_id) VALUES
      (v_form, v_start, v_name), (v_form, v_name, v_web), (v_form, v_web, v_sector),
      (v_form, v_sector, v_contact), (v_form, v_contact, v_stage),
      (v_form, v_stage, v_why), (v_form, v_why, v_end);
  END LOOP;
END $$;

-- ─── The form cannot be pointed somewhere else ──────────────────────────────
-- Without this, the bypass returns by an edit rather than a new form: repoint the partner form at
-- Deal Pipeline and every referral skips the coordinator again, silently.
CREATE OR REPLACE FUNCTION public.partner_form_pipeline_check() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_partner_form THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pipelines p
      WHERE p.id = NEW.pipeline_id AND p.is_partner_intake
    ) THEN
      RAISE EXCEPTION 'The partner form must feed the partner-intake pipeline.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS forms_partner_pipeline ON public.forms;
CREATE TRIGGER forms_partner_pipeline
  BEFORE INSERT OR UPDATE OF is_partner_form, pipeline_id ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.partner_form_pipeline_check();

-- ─── Partners issue links from that form only ───────────────────────────────
-- The rule that makes "one form to rule them all" true rather than a convention. Enforced in the
-- database because it decides where a referral lands, and a UI-only restriction is bypassed by
-- anything that posts directly.
DROP POLICY IF EXISTS "Partners create links on the partner form" ON public.form_links;
CREATE POLICY "Partners create links on the partner form"
  ON public.form_links FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'franchise_partner'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_id
        AND f.org_id = public.get_user_org_id()
        AND f.is_partner_form
    )
  );

-- Partners see the partner form and nothing else. Reading the whole form list would show them the
-- internal intake flows, which are none of their business and are not theirs to send out.
DROP POLICY IF EXISTS "Partners read the partner form" ON public.forms;
CREATE POLICY "Partners read the partner form"
  ON public.forms FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND org_id = public.get_user_org_id()
    AND is_partner_form
  );

DROP POLICY IF EXISTS "Partners read own links" ON public.form_links;
CREATE POLICY "Partners read own links"
  ON public.form_links FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'franchise_partner'
    AND created_by = auth.uid()
  );

-- ─── Attribution through the link ───────────────────────────────────────────
-- A submission through a partner's link must be attributed to that partner, or the referral is
-- anonymous and the fee conversation has nothing to stand on. Set at insert time by trigger rather
-- than trusting the submitting form, which is public and unauthenticated.
CREATE OR REPLACE FUNCTION public.attribute_entry_to_partner() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sourced_by_partner_id IS NULL AND NEW.form_link_id IS NOT NULL THEN
    SELECT u.franchise_partner_id INTO NEW.sourced_by_partner_id
      FROM public.form_links fl
      JOIN public.users u ON u.id = fl.created_by
     WHERE fl.id = NEW.form_link_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pipeline_entries_attribute_partner ON public.pipeline_entries;
CREATE TRIGGER pipeline_entries_attribute_partner
  BEFORE INSERT ON public.pipeline_entries
  FOR EACH ROW EXECUTE FUNCTION public.attribute_entry_to_partner();
