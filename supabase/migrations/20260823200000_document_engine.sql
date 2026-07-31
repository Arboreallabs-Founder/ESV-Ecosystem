-- Phase 3 of HR document generation (see docs/DOCUMENTS_BUILD_PLAN.md).
--
-- Three tables: the catalogue of document types, who may issue each, and the record of every
-- letter ever produced.

DO $$ BEGIN
  CREATE TYPE document_signature_mode AS ENUM ('system', 'visual', 'physical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_category AS ENUM ('leave', 'verification', 'onboarding', 'compensation', 'exit', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Catalogue ──────────────────────────────────────────────────────────────
-- Global, not per-org: these are the document kinds the app knows how to render, and each needs
-- a matching template in code. An org enables or disables them via document_permissions.
CREATE TABLE IF NOT EXISTS public.document_types (
  code            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        document_category NOT NULL,
  signature_mode  document_signature_mode NOT NULL,
  -- Three letters, used in the human-readable id: ESV/2026/EVL/0042
  id_segment      TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Document types readable" ON public.document_types;
CREATE POLICY "Document types readable" ON public.document_types
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.document_types (code, name, category, signature_mode, id_segment, sort_order) VALUES
  ('leave_sanction',        'Leave Sanction Letter',             'leave',         'system',   'LSL', 10),
  ('wfh_approval',          'WFH Approval Letter',               'leave',         'system',   'WFH', 20),
  ('comp_off',              'Comp-off Confirmation',             'leave',         'system',   'COC', 30),

  ('employment_verification','Employment Verification Letter',   'verification',  'physical', 'EVL', 40),
  ('address_proof',         'Address Proof',                     'verification',  'physical', 'APL', 50),
  ('bank_account_opening',  'Bank Account Opening Letter',       'verification',  'physical', 'BAO', 60),
  ('visa_support',          'Visa / Travel Support Letter',      'verification',  'physical', 'VSL', 70),
  ('noc_travel',            'NOC — Travel',                      'verification',  'physical', 'NCT', 80),
  ('noc_study',             'NOC — Higher Study',                'verification',  'physical', 'NCS', 90),

  ('offer_letter',          'Offer Letter',                      'onboarding',    'system',   'OFL', 100),
  ('appointment_letter',    'Appointment Letter',                'onboarding',    'system',   'APT', 110),
  ('internship_offer',      'Internship Offer Letter',           'onboarding',    'system',   'IOL', 120),
  ('internship_completion', 'Internship Completion Certificate', 'onboarding',    'system',   'ICC', 130),
  ('probation_confirmation','Probation Confirmation Letter',     'onboarding',    'system',   'PCL', 140),
  ('nda',                   'NDA / Confidentiality Undertaking', 'onboarding',    'system',   'NDA', 150),
  ('code_of_conduct',       'Code of Conduct Acknowledgement',   'onboarding',    'system',   'COD', 160),

  ('salary_certificate',    'Salary Certificate',                'compensation',  'visual',   'SAL', 170),
  ('payslip',               'Payslip',                           'compensation',  'visual',   'PAY', 180),
  ('ctc_breakdown',         'CTC Breakdown Statement',           'compensation',  'visual',   'CTC', 190),
  ('increment_letter',      'Increment Letter',                  'compensation',  'visual',   'INC', 200),
  ('promotion_letter',      'Promotion Letter',                  'compensation',  'visual',   'PRM', 210),
  ('bonus_letter',          'Bonus / Incentive Letter',          'compensation',  'visual',   'BON', 220),

  ('resignation_acceptance','Resignation Acceptance',            'exit',          'physical', 'RSA', 230),
  ('relieving_letter',      'Relieving Letter',                  'exit',          'physical', 'REL', 240),
  ('experience_certificate','Experience / Service Certificate',  'exit',          'physical', 'EXP', 250),
  ('no_dues',               'No-Dues Certificate',               'exit',          'physical', 'NDC', 260),
  ('full_final_settlement', 'Full & Final Settlement Statement', 'exit',          'physical', 'FNF', 270),

  ('testimonial',           'Testimonial',                       'other',         'physical', 'TST', 280),
  ('best_performer',        'Best Performer Certificate',        'other',         'system',   'BPC', 290)
ON CONFLICT (code) DO NOTHING;

-- ─── Who may issue what ─────────────────────────────────────────────────────
-- This table exists specifically so issuance rights are data rather than code. The founder asked
-- to hand parts of the compensation tier to middle management as the org grows "without the
-- structure being fixed" — as a role array in TypeScript that is a migration and a deploy; here
-- it is an UPDATE.
CREATE TABLE IF NOT EXISTS public.document_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id),
  document_code TEXT NOT NULL REFERENCES public.document_types(code) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  can_issue     BOOLEAN NOT NULL DEFAULT true,
  updated_by    UUID REFERENCES public.users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, document_code, role)
);

CREATE INDEX IF NOT EXISTS idx_doc_perms_lookup
  ON public.document_permissions(org_id, document_code, role) WHERE can_issue;

ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone internal can read the matrix — the UI has to know which buttons to show.
DROP POLICY IF EXISTS "Document permissions select" ON public.document_permissions;
CREATE POLICY "Document permissions select" ON public.document_permissions
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR org_id = public.get_user_org_id());

-- Only founders change who may issue what.
DROP POLICY IF EXISTS "Document permissions write" ON public.document_permissions;
CREATE POLICY "Document permissions write" ON public.document_permissions
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'founder')
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() = 'founder');

-- Seed the approved matrix for every existing org (docs/DOCUMENTS.md).
INSERT INTO public.document_permissions (org_id, document_code, role)
SELECT o.id, m.code, m.role
FROM public.organizations o
CROSS JOIN (VALUES
  ('leave_sanction','hr'),('leave_sanction','admin'),
  ('wfh_approval','hr'),('wfh_approval','admin'),
  ('comp_off','hr'),('comp_off','founder'),

  ('employment_verification','hr'),('employment_verification','admin'),
  ('address_proof','hr'),('address_proof','admin'),
  ('bank_account_opening','hr'),('bank_account_opening','admin'),
  ('visa_support','hr'),('visa_support','admin'),
  ('noc_travel','hr'),('noc_travel','admin'),('noc_travel','founder'),
  ('noc_study','hr'),('noc_study','admin'),('noc_study','founder'),

  ('offer_letter','hr'),('offer_letter','admin'),('offer_letter','founder'),
  ('appointment_letter','hr'),('appointment_letter','admin'),
  ('internship_offer','hr'),('internship_offer','admin'),
  ('internship_completion','hr'),('internship_completion','admin'),
  ('probation_confirmation','hr'),('probation_confirmation','admin'),
  ('nda','hr'),('nda','admin'),
  ('code_of_conduct','hr'),('code_of_conduct','admin'),

  ('salary_certificate','hr'),('salary_certificate','admin'),('salary_certificate','founder'),
  -- Payslip excludes admin while every other compensation document includes them. Deliberate,
  -- per the founder's response — not a transcription slip.
  ('payslip','hr'),('payslip','founder'),
  ('ctc_breakdown','hr'),('ctc_breakdown','admin'),('ctc_breakdown','founder'),
  ('increment_letter','hr'),('increment_letter','admin'),('increment_letter','founder'),
  ('promotion_letter','hr'),('promotion_letter','admin'),('promotion_letter','founder'),
  ('bonus_letter','hr'),('bonus_letter','admin'),('bonus_letter','founder'),

  ('resignation_acceptance','hr'),('resignation_acceptance','founder'),
  ('relieving_letter','hr'),('relieving_letter','admin'),
  ('experience_certificate','hr'),('experience_certificate','admin'),
  ('no_dues','hr'),('no_dues','admin'),
  ('full_final_settlement','hr'),('full_final_settlement','admin'),

  ('testimonial','hr'),('testimonial','founder'),
  ('best_performer','hr'),('best_performer','admin'),('best_performer','founder')
) AS m(code, role)
ON CONFLICT (org_id, document_code, role) DO NOTHING;

-- ─── Issued documents ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.issued_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.organizations(id),
  document_code   TEXT NOT NULL REFERENCES public.document_types(code),
  subject_user_id UUID NOT NULL REFERENCES public.users(id),

  -- Printed on the letter. Sequential and therefore guessable, which is exactly why it is not
  -- what grants access to the verification page.
  human_id        TEXT NOT NULL,
  -- What the QR points at. High entropy, because human_id can be incremented by hand.
  verify_token    TEXT NOT NULL UNIQUE,

  storage_path    TEXT,
  sha256          TEXT,

  -- Every value merged into the letter, frozen at issue time. A letter asserts facts as at its
  -- issue date; if a designation changes next year the letter already sent must not change with
  -- it. Re-deriving from live tables would do exactly that.
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Copied from document_types at issue time rather than read live, so changing the policy later
  -- doesn't retroactively rewrite what a document claims about itself.
  signature_mode  document_signature_mode NOT NULL,

  issued_by       UUID REFERENCES public.users(id),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES public.users(id),
  revoked_reason  TEXT,

  UNIQUE (org_id, human_id)
);

CREATE INDEX IF NOT EXISTS idx_issued_docs_subject ON public.issued_documents(subject_user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_issued_docs_org ON public.issued_documents(org_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_issued_docs_token ON public.issued_documents(verify_token);

ALTER TABLE public.issued_documents ENABLE ROW LEVEL SECURITY;

-- Leadership and HR see everything issued; everyone else sees documents about themselves.
-- The public verification page does NOT read through this — it goes through a SECURITY DEFINER
-- function that returns only the few fields a verifier needs (see below).
DROP POLICY IF EXISTS "Issued documents select" ON public.issued_documents;
CREATE POLICY "Issued documents select" ON public.issued_documents
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR subject_user_id = auth.uid()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'))
  );

-- Insert is gated on the permission matrix rather than a hardcoded role list — the whole point
-- of document_permissions. The server action checks it too; this is the backstop.
DROP POLICY IF EXISTS "Issued documents insert" ON public.issued_documents;
CREATE POLICY "Issued documents insert" ON public.issued_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND issued_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.document_permissions p
      WHERE p.org_id = public.get_user_org_id()
        AND p.document_code = issued_documents.document_code
        AND p.role = public.get_user_role()
        AND p.can_issue
    )
  );

-- Update exists to record storage_path/sha256 after generation and to revoke. Issued documents
-- are otherwise immutable — there is no policy allowing the payload or ids to be rewritten by
-- anyone but founder/admin/HR, and no DELETE policy at all: a withdrawn document is revoked, not
-- erased, or the verification link 404s and reads as a fake.
DROP POLICY IF EXISTS "Issued documents update" ON public.issued_documents;
CREATE POLICY "Issued documents update" ON public.issued_documents
  FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'))
  WITH CHECK (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'hr'));

-- ─── Human-readable id allocation ───────────────────────────────────────────
-- ESV/2026/EVL/0042 — per org, per year, per document type. SECURITY DEFINER because the count
-- has to see rows the caller may not be able to, and advisory-locked so two people issuing the
-- same document type in the same second cannot take the same number.
CREATE OR REPLACE FUNCTION public.next_document_human_id(p_org_id UUID, p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_segment TEXT;
  v_year    TEXT := to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY');
  v_next    INTEGER;
BEGIN
  SELECT id_segment INTO v_segment FROM public.document_types WHERE code = p_code;
  IF v_segment IS NULL THEN
    RAISE EXCEPTION 'Unknown document type: %', p_code;
  END IF;

  -- Serialise allocation for this org+type. Released at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text || p_code));

  SELECT COALESCE(MAX(split_part(human_id, '/', 4)::INTEGER), 0) + 1
    INTO v_next
    FROM public.issued_documents
   WHERE org_id = p_org_id
     AND document_code = p_code
     AND split_part(human_id, '/', 2) = v_year;

  RETURN 'ESV/' || v_year || '/' || v_segment || '/' || lpad(v_next::TEXT, 4, '0');
END;
$$;

-- ─── Public verification ────────────────────────────────────────────────────
-- The one thing an unauthenticated visitor can do. SECURITY DEFINER so it can read the row
-- without granting anonymous SELECT on the table, and it returns only what a verifier needs —
-- never the payload, never the storage path.
CREATE OR REPLACE FUNCTION public.verify_document(p_token TEXT)
RETURNS TABLE (
  human_id       TEXT,
  document_name  TEXT,
  subject_name   TEXT,
  issued_at      TIMESTAMPTZ,
  signature_mode document_signature_mode,
  revoked        BOOLEAN,
  org_name       TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT d.human_id,
         t.name,
         u.name,
         d.issued_at,
         d.signature_mode,
         d.revoked_at IS NOT NULL,
         o.name
    FROM public.issued_documents d
    JOIN public.document_types t ON t.code = d.document_code
    JOIN public.users u ON u.id = d.subject_user_id
    JOIN public.organizations o ON o.id = d.org_id
   WHERE d.verify_token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.verify_document(TEXT) TO anon, authenticated;

-- ─── Storage ────────────────────────────────────────────────────────────────
-- Private: the PDF itself is reached through a signed URL from the app, never by guessing a path.
-- The public verification page confirms a document exists and what it says; it does not hand out
-- the document.
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "HR documents read" ON storage.objects;
CREATE POLICY "HR documents read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'hr-documents'
    AND (public.is_super_admin() OR public.get_user_role() IN ('founder', 'admin', 'hr'))
  );

DROP POLICY IF EXISTS "HR documents write" ON storage.objects;
CREATE POLICY "HR documents write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hr-documents'
    AND (public.is_super_admin() OR public.get_user_role() IN ('founder', 'admin', 'hr'))
  );
