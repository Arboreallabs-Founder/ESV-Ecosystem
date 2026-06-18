-- Harden entry_has_active_deal: pin search_path (consistent with the other
-- SECURITY DEFINER helpers) to clear the function_search_path_mutable advisor.
ALTER FUNCTION public.entry_has_active_deal(uuid) SET search_path = public;
