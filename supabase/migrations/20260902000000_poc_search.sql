-- Track the work of getting a new POC at a fund.
--
-- 149 of the 272 imported funds have nobody we can confirm is reachable — 65 of them because the
-- person we knew has left. That is a work queue, and a badge alone does not get it worked through.
--
-- The hunt is a real Task on the existing board rather than a new kind of to-do. The assignee
-- already lives there: it drives their alerts, their KPI numbers and their weekly update. A
-- parallel list would be one more place for work to be forgotten. Same reasoning as the SGP intake
-- and the attendance approvals.

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS poc_search_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS poc_search_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.investors.poc_search_task_id IS
  'The open task to find a new point of contact at this fund. Cleared if the task is deleted.';

-- The queue: funds with a hunt already under way, so nobody assigns a second one.
CREATE INDEX IF NOT EXISTS idx_investors_poc_search
  ON public.investors(org_id) WHERE poc_search_task_id IS NOT NULL;

-- Deliberately NOT a `needs_poc` column. Whether a fund needs a POC is derived from its contacts
-- every time it is read: a stored flag would be wrong the moment somebody marks a contact active,
-- and a stale one is worse than none — it sends people hunting for a contact that already exists,
-- or hides a fund that has quietly gone dark.
