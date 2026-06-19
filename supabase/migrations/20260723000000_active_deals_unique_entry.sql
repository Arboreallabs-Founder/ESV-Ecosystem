-- An entry can have at most one active deal. Re-accepting an entry whose deal still
-- lingers (after being moved out of Accepted) must reuse it, never create a duplicate.
-- acceptDeal() guards this in code; this index enforces it at the DB level too.
CREATE UNIQUE INDEX IF NOT EXISTS active_deals_pipeline_entry_uniq
  ON public.active_deals(pipeline_entry_id);
