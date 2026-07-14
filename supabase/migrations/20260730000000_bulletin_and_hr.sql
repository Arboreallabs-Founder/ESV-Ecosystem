-- Company-wide Bulletin Board (upcoming events + announcements) and HR Zone (read-only policies).
-- Both are internal-only (founder/admin/associate — no franchise_partner access), org-scoped.

DO $$ BEGIN CREATE TYPE bulletin_post_type AS ENUM ('event', 'announcement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── bulletin_posts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bulletin_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  post_type  bulletin_post_type NOT NULL DEFAULT 'announcement',
  title      TEXT NOT NULL,
  body       TEXT,
  event_date DATE,
  event_time TIME,
  location   TEXT,
  pinned     BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulletin_posts_org ON public.bulletin_posts(org_id);

ALTER TABLE public.bulletin_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal view bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Internal view bulletin posts"
  ON public.bulletin_posts FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate')));

DROP POLICY IF EXISTS "Admins manage bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Admins manage bulletin posts"
  ON public.bulletin_posts FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));

DROP POLICY IF EXISTS "Admins update bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Admins update bulletin posts"
  ON public.bulletin_posts FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));

DROP POLICY IF EXISTS "Admins delete bulletin posts" ON public.bulletin_posts;
CREATE POLICY "Admins delete bulletin posts"
  ON public.bulletin_posts FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));

-- ─── hr_policies ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_policies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id),
  title      TEXT NOT NULL,
  category   TEXT,
  body       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_policies_org ON public.hr_policies(org_id);

-- Reuses the set_updated_at() helper created in 20260713100000_companies.sql.
DROP TRIGGER IF EXISTS hr_policies_set_updated_at ON public.hr_policies;
CREATE TRIGGER hr_policies_set_updated_at
  BEFORE UPDATE ON public.hr_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hr_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal view hr policies" ON public.hr_policies;
CREATE POLICY "Internal view hr policies"
  ON public.hr_policies FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin', 'associate')));

DROP POLICY IF EXISTS "Admins create hr policies" ON public.hr_policies;
CREATE POLICY "Admins create hr policies"
  ON public.hr_policies FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));

DROP POLICY IF EXISTS "Admins update hr policies" ON public.hr_policies;
CREATE POLICY "Admins update hr policies"
  ON public.hr_policies FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')))
  WITH CHECK (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));

DROP POLICY IF EXISTS "Admins delete hr policies" ON public.hr_policies;
CREATE POLICY "Admins delete hr policies"
  ON public.hr_policies FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.get_user_role() IN ('founder', 'admin')));
