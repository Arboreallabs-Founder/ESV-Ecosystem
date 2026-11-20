-- ═══════════════════════════════════════════════════════════════════════════
-- activity_events: one row per create / update / delete on the core records, whoever made it.
--
-- Written by triggers, not by the app, so nothing can skip it: web edits, the AI connector
-- (/api/mcp), stage automations, CSV imports and form submissions all land here. The per-module
-- edit logs (investors, HR policies, events) are unchanged; Admin → Activity Log shows both.
--
-- source:
--   connector  the request came through /api/mcp (the token-bound client sends
--              x-ecosystem-source: connector; x-ecosystem-client names the app)
--   web        any other signed-in request
--   system     no signed-in user (public form submissions, cron, SQL)
-- The header is set by our server, but a determined user could send it from their own session. All
-- it can do is mislabel their own edits as "connector"; the actor is still auth.uid().
--
-- Logging must never cost the write it describes: the insert is wrapped so a logging failure only
-- raises a WARNING.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.activity_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID,
  -- No FK: an actor without a users row must still be loggable, and deleting a user must not
  -- erase what they did.
  actor_id     UUID,
  source       TEXT NOT NULL CHECK (source IN ('web', 'connector', 'system')),
  client       TEXT,
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  entity_label TEXT,
  action       TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  -- created: the new row (nulls stripped) · updated: {field: {before, after}} · deleted: the old row
  changes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_events_org_time ON public.activity_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_entity   ON public.activity_events (entity_type, entity_id, created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- Read: founders/admins of the org (the Activity Log audience), super admin anywhere. No write
-- policies at all — only the SECURITY DEFINER trigger below inserts.
DROP POLICY IF EXISTS "Activity events read" ON public.activity_events;
CREATE POLICY "Activity events read" ON public.activity_events FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin'))
  );

-- ─── Trigger function ───────────────────────────────────────────────────────
-- TG_ARGV[0] entity_type · TG_ARGV[1] column holding a human label (or '') · TG_ARGV[2] column
-- holding the entity id (default 'id' — child rows point at their parent, e.g. company_id).
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity   TEXT := TG_ARGV[0];
  v_labelcol TEXT := nullif(TG_ARGV[1], '');
  v_idcol    TEXT := coalesce(nullif(TG_ARGV[2], ''), 'id');
  v_old      JSONB := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_new      JSONB := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_row      JSONB;
  v_changes  JSONB := '{}'::jsonb;
  v_key      TEXT;
  v_org      UUID;
  v_label    TEXT;
  v_headers  JSONB;
  v_source   TEXT;
BEGIN
  v_row := coalesce(v_new, v_old);

  IF TG_OP = 'UPDATE' THEN
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      CONTINUE WHEN v_key IN ('updated_at', 'created_at');
      IF (v_new -> v_key) IS DISTINCT FROM (v_old -> v_key) THEN
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('before', v_old -> v_key, 'after', v_new -> v_key));
      END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN RETURN NULL; END IF;  -- a no-op update is not an event
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := jsonb_strip_nulls(v_new) - 'created_at' - 'updated_at';
  ELSE
    v_changes := jsonb_strip_nulls(v_old);
  END IF;

  BEGIN
    -- Org: on the row, or via the parent pipeline / entry for tables that don't carry it.
    v_org := (v_row ->> 'org_id')::uuid;
    IF v_org IS NULL AND v_row ? 'pipeline_id' THEN
      SELECT org_id INTO v_org FROM pipelines WHERE id = (v_row ->> 'pipeline_id')::uuid;
    END IF;
    IF v_org IS NULL AND v_row ? 'pipeline_entry_id' THEN
      SELECT pl.org_id INTO v_org FROM pipeline_entries pe JOIN pipelines pl ON pl.id = pe.pipeline_id
       WHERE pe.id = (v_row ->> 'pipeline_entry_id')::uuid;
    END IF;
    IF v_org IS NULL AND v_row ? 'entry_id' THEN
      SELECT pl.org_id INTO v_org FROM pipeline_entries pe JOIN pipelines pl ON pl.id = pe.pipeline_id
       WHERE pe.id = (v_row ->> 'entry_id')::uuid;
    END IF;

    -- Label: the named column, or the obvious parent's name.
    IF v_labelcol IS NOT NULL THEN v_label := left(v_row ->> v_labelcol, 200); END IF;
    IF v_label IS NULL AND v_entity = 'deal' THEN
      SELECT title INTO v_label FROM pipeline_entries WHERE id = (v_row ->> 'pipeline_entry_id')::uuid;
    ELSIF v_label IS NULL AND v_entity IN ('company_field', 'company_update') THEN
      SELECT name INTO v_label FROM companies WHERE id = (v_row ->> 'company_id')::uuid;
    ELSIF v_label IS NULL AND v_entity = 'pipeline_entry_assignee' THEN
      SELECT title INTO v_label FROM pipeline_entries WHERE id = (v_row ->> 'entry_id')::uuid;
    ELSIF v_label IS NULL AND v_entity = 'task_comment' THEN
      SELECT title INTO v_label FROM tasks WHERE id = (v_row ->> 'task_id')::uuid;
    END IF;
    IF v_entity = 'company_field' THEN
      -- Say which field, not just which company.
      v_changes := v_changes || jsonb_build_object('field',
        (SELECT label FROM company_field_defs WHERE id = (v_row ->> 'field_def_id')::uuid));
    END IF;

    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_source := CASE
      WHEN v_headers ->> 'x-ecosystem-source' = 'connector' THEN 'connector'
      WHEN auth.uid() IS NULL THEN 'system'
      ELSE 'web'
    END;

    INSERT INTO activity_events (org_id, actor_id, source, client, entity_type, entity_id, entity_label, action, changes)
    VALUES (
      v_org, auth.uid(), v_source,
      CASE WHEN v_source = 'connector' THEN left(v_headers ->> 'x-ecosystem-client', 100) END,
      v_entity, (v_row ->> v_idcol)::uuid, v_label,
      CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END,
      v_changes
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'activity log skipped for % %: %', v_entity, TG_OP, SQLERRM;
  END;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.log_activity() FROM PUBLIC, anon, authenticated;

-- ─── Where it's attached ────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('companies',                 'company',                 'name',  'id'),
    ('company_field_defs',        'company_field_def',       'label', 'id'),
    ('company_field_values',      'company_field',           '',      'company_id'),
    ('company_updates',           'company_update',          '',      'company_id'),
    ('tasks',                     'task',                    'title', 'id'),
    ('task_comments',             'task_comment',            '',      'task_id'),
    ('pipeline_entries',          'pipeline_entry',          'title', 'id'),
    ('pipeline_entry_assignees',  'pipeline_entry_assignee', '',      'entry_id'),
    ('active_deals',              'deal',                    '',      'id')
  ) AS t(tbl, entity, labelcol, idcol)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS log_activity ON public.%I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER log_activity AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.log_activity(%L, %L, %L)',
      r.tbl, r.entity, r.labelcol, r.idcol);
  END LOOP;
END $$;
