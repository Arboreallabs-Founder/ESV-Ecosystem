-- Multi-tenancy Phase 2: add org_id to all root tables, backfill ESV data

-- 1. Seed the ESV org with a fixed UUID (all existing data becomes this tenant)
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Earlyseed Ventures', 'esv')
ON CONFLICT (id) DO NOTHING;

-- 2. Add org_id columns (nullable first so backfill can run before NOT NULL)
ALTER TABLE public.users              ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.approved_emails    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.franchise_partners ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.investors          ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tasks              ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.pipelines          ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.forms              ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.deal_categories    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 3. Backfill all existing rows to ESV org
UPDATE public.users              SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.approved_emails    SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.franchise_partners SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.investors          SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.tasks              SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.pipelines          SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.forms              SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.deal_categories    SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- 4. Add NOT NULL constraints
-- users: super_admin rows will have org_id = NULL, so use a CHECK instead
ALTER TABLE public.users ADD CONSTRAINT users_org_id_check
  CHECK (org_id IS NOT NULL OR role = 'super_admin');

ALTER TABLE public.franchise_partners ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.investors          ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.tasks              ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.pipelines          ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.forms              ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.deal_categories    ALTER COLUMN org_id SET NOT NULL;
-- approved_emails.org_id stays nullable (super_admin entry has org_id = NULL)

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_users_org              ON public.users(org_id);
CREATE INDEX IF NOT EXISTS idx_approved_emails_org    ON public.approved_emails(org_id);
CREATE INDEX IF NOT EXISTS idx_franchise_partners_org ON public.franchise_partners(org_id);
CREATE INDEX IF NOT EXISTS idx_investors_org          ON public.investors(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org              ON public.tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_org          ON public.pipelines(org_id);
CREATE INDEX IF NOT EXISTS idx_forms_org              ON public.forms(org_id);
CREATE INDEX IF NOT EXISTS idx_deal_categories_org    ON public.deal_categories(org_id);
