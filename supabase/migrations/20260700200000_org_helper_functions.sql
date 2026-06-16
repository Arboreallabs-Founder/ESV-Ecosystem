-- Multi-tenancy Phase 3: SECURITY DEFINER helper functions for org-scoped RLS

-- Returns the org_id of the currently authenticated user.
-- Returns NULL for super_admin (they have no org). Used in all RLS policies.
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns TRUE if the current user is a super_admin.
-- Used as the bypass predicate — must come FIRST in OR clauses so Postgres short-circuits
-- before evaluating org_id = get_user_org_id() (which would be NULL = X → false).
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
