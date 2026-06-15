-- Investor section redesign: drop flat table, create normalized schema with
-- investor_contacts and referral tracking.
-- NOTE: fund_outreach does not exist in this project yet — that ALTER is omitted.

-- 1. Drop old investors table
DROP TABLE IF EXISTS public.investors CASCADE;

-- 2. New investors table
CREATE TABLE public.investors (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  country                TEXT,
  website                TEXT,
  sectors                TEXT[] NOT NULL DEFAULT '{}',
  service_type           TEXT NOT NULL
                           CHECK (service_type IN ('vc_fund','angel_fund','family_office','angel_investor')),
  esv_poc_id             UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ticket_size_min        NUMERIC,
  ticket_size_max        NUMERIC,
  stage                  TEXT,
  referred_by_partner_id UUID REFERENCES public.franchise_partners(id) ON DELETE SET NULL,
  created_by             UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_investors_referred_by ON public.investors(referred_by_partner_id);

-- 3. New investor_contacts table (vc_fund / angel_fund / family_office only)
CREATE TABLE public.investor_contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id      UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  role             TEXT,
  linkedin_url     TEXT,
  linkedin_status  TEXT CHECK (linkedin_status IN
                     ('Connected','1st','2nd','3rd','Pending','Not Connected')),
  phone            TEXT,
  email            TEXT,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.investor_contacts ENABLE ROW LEVEL SECURITY;

-- 4. RLS for investors
CREATE POLICY "Internal full access"
  ON public.investors FOR ALL TO authenticated
  USING (get_user_role() IN ('founder','admin','associate'))
  WITH CHECK (get_user_role() IN ('founder','admin','associate'));

CREATE POLICY "Partners can insert referrals"
  ON public.investors FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'franchise_partner'
    AND referred_by_partner_id = (
      SELECT franchise_partner_id FROM public.users WHERE id = auth.uid()
    )
  );

-- 5. RLS for investor_contacts
CREATE POLICY "Internal full access"
  ON public.investor_contacts FOR ALL TO authenticated
  USING (get_user_role() IN ('founder','admin','associate'))
  WITH CHECK (get_user_role() IN ('founder','admin','associate'));

CREATE POLICY "Partners can insert contacts on own referrals"
  ON public.investor_contacts FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'franchise_partner'
    AND EXISTS (
      SELECT 1 FROM public.investors i
      WHERE i.id = investor_id
        AND i.referred_by_partner_id = (
          SELECT franchise_partner_id FROM public.users WHERE id = auth.uid()
        )
    )
  );
