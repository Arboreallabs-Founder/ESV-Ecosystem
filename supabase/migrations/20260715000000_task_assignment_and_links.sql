-- Task assignment attribution + record links
-- assigned_by_id: who verbally/actually assigned the work (e.g. an MD), which can
-- differ from created_by (whoever logged it into the system on their behalf).
-- company_id / desk_deal_id / link_url: optional links from a task to a Company
-- profile, a Deal Desk deal, or any other supporting URL.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_by_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS company_id     UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS desk_deal_id   UUID REFERENCES public.desk_deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS link_url       TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_company_id   ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_desk_deal_id ON public.tasks(desk_deal_id);

-- Backfill: existing tasks default assigned_by to their creator.
UPDATE public.tasks SET assigned_by_id = created_by WHERE assigned_by_id IS NULL;
