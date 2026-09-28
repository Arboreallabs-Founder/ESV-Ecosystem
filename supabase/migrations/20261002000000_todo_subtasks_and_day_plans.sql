-- Sub-tasks on personal to-dos, and the daily plan / end-of-day report that feeds them.
--
-- Three things, one migration, because they are one feature: you write your plan for the day, the
-- lines become to-dos, the to-dos can hold sub-items, and all of it rolls up into the week.

-- ─── 1. Sub-tasks ───────────────────────────────────────────────────────────
-- Self-referencing parent, capped at ONE level (see the trigger below). A personal list that
-- allows arbitrary depth becomes an outliner nobody maintains; the shape being copied here is the
-- Google Keep note this replaces — a heading and the things under it.
--
-- ON DELETE CASCADE: deleting a parent takes its sub-items. The alternative (orphaning them to the
-- top level) silently grows the list every time someone tidies up.
ALTER TABLE public.personal_todos
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.personal_todos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_personal_todos_parent ON public.personal_todos(parent_id);

-- Depth cap. A CHECK constraint cannot see other rows, so this is a trigger: a row may have a
-- parent, but that parent may not itself have one. Enforced in the database rather than only in
-- the action, because the two-level assumption is baked into every query and render that follows.
-- SECURITY DEFINER so the parent lookup cannot be defeated by RLS hiding the parent row: the
-- depth cap must hold whatever the caller can see.
CREATE OR REPLACE FUNCTION public.personal_todos_enforce_one_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'A to-do cannot be its own parent.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.personal_todos p WHERE p.id = NEW.parent_id AND p.parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Sub-tasks can only go one level deep.';
    END IF;
  END IF;
  -- The mirror of the rule: a row that already has children cannot itself become a child.
  IF NEW.parent_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.personal_todos c WHERE c.parent_id = NEW.id) THEN
    RAISE EXCEPTION 'This item has sub-tasks, so it cannot become a sub-task itself.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personal_todos_one_level ON public.personal_todos;
CREATE TRIGGER personal_todos_one_level
  BEFORE INSERT OR UPDATE OF parent_id ON public.personal_todos
  FOR EACH ROW EXECUTE FUNCTION public.personal_todos_enforce_one_level();

-- ─── 2. The day a to-do is planned for ──────────────────────────────────────
-- Distinct from due_date and from work_week_start, and all three earn their place:
--   due_date        — when it must be finished by (a commitment).
--   work_week_start — which week's update it belongs to (an act of sharing).
--   plan_date       — the day you intend to actually do it (an intention, revised daily).
-- An item can be planned for today, due Friday, and filed under this week, all at once.
ALTER TABLE public.personal_todos
  ADD COLUMN IF NOT EXISTS plan_date DATE;

CREATE INDEX IF NOT EXISTS idx_personal_todos_plan_date ON public.personal_todos(user_id, plan_date);

-- ─── 3. Daily plans ─────────────────────────────────────────────────────────
-- One row per person per day per half: 'morning' is what you intend to do today, 'evening' is the
-- wrap — how the day went, and what tomorrow looks like. The to-do lines a plan produces are
-- personal_todos rows carrying plan_date; this table holds the note around them, so the report
-- reads as something a person wrote rather than a list of fragments.
CREATE TABLE IF NOT EXISTS public.day_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  plan_date  DATE NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('morning', 'evening')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Re-opening the form edits today's entry rather than filing a second one.
  UNIQUE (user_id, plan_date, kind)
);

CREATE INDEX IF NOT EXISTS idx_day_plans_org_date ON public.day_plans(org_id, plan_date DESC);

-- Reuses the set_updated_at() helper from 20260713100000_companies.sql.
DROP TRIGGER IF EXISTS day_plans_set_updated_at ON public.day_plans;
CREATE TRIGGER day_plans_set_updated_at
  BEFORE UPDATE ON public.day_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;

-- Your own, always.
DROP POLICY IF EXISTS "Users manage own day plans" ON public.day_plans;
CREATE POLICY "Users manage own day plans"
  ON public.day_plans FOR ALL TO authenticated
  USING (public.is_super_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_super_admin() OR (user_id = auth.uid() AND org_id = public.get_user_org_id()));

-- Leadership reads everyone's. This is a deliberate departure from how personal_todos works:
-- to-dos are private until you file one into a work week, whereas a daily report is a report —
-- submitting it IS sending it. The UI says so at the point of writing, because a surface that
-- looks private and is not would be the worst of both.
DROP POLICY IF EXISTS "Leads read day plans" ON public.day_plans;
CREATE POLICY "Leads read day plans"
  ON public.day_plans FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin')
  );

-- ─── 4. Leadership can read the items a report refers to ────────────────────
-- 20260818000000 let leads read personal to-dos that carry a work week, on the reasoning that
-- assigning a week is the opt-in. A daily report needs the same treatment for its own items:
-- a report listing three things is useless if the three things are unreadable.
--
-- Everything else stays private. An item with no work week AND no plan_date is visible to nobody
-- but its owner, exactly as before.
DROP POLICY IF EXISTS "Leads read week-assigned personal todos" ON public.personal_todos;
CREATE POLICY "Leads read week-assigned personal todos"
  ON public.personal_todos FOR SELECT TO authenticated
  USING (
    (work_week_start IS NOT NULL OR plan_date IS NOT NULL)
    AND org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin')
  );

-- A sub-task inherits its parent's audience: leads reading a planned parent must see what is
-- under it, or the rollup shows "Kyoora 1/2" with nothing beneath it.
--
-- The parent lookup goes through a SECURITY DEFINER function rather than a subquery in the policy
-- body. A policy on personal_todos that itself selects from personal_todos re-enters RLS and
-- Postgres aborts with infinite recursion; a definer function runs outside RLS and ends it. Same
-- reason get_user_role() exists rather than a subquery over users.
CREATE OR REPLACE FUNCTION public.todo_parent_is_shared(p_parent_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personal_todos p
    WHERE p.id = p_parent_id
      AND (p.work_week_start IS NOT NULL OR p.plan_date IS NOT NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.todo_parent_is_shared(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.todo_parent_is_shared(UUID) TO authenticated;

DROP POLICY IF EXISTS "Leads read subtasks of visible todos" ON public.personal_todos;
CREATE POLICY "Leads read subtasks of visible todos"
  ON public.personal_todos FOR SELECT TO authenticated
  USING (
    parent_id IS NOT NULL
    AND org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('founder', 'admin')
    AND public.todo_parent_is_shared(parent_id)
  );
