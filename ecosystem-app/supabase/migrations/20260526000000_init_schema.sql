-- Create enum types
CREATE TYPE deal_stage AS ENUM (
  'New Lead', 'JotForm Received', 'First Call Scheduled', 'First Call Done',
  'Analysis in Progress', 'Second Call / Mandate Sent', 'Mandate Accepted',
  'Memo Created', 'Fund Outreach Active', 'Closed Success', 'Closed Dead'
);

CREATE TYPE outreach_status AS ENUM (
  'Sent', 'Responded', 'Passed', 'Interested'
);

CREATE TYPE memo_status AS ENUM (
  'Draft', 'In Review', 'Final'
);

CREATE TYPE user_role AS ENUM (
  'founder', 'associate', 'admin', 'franchise_partner'
);

-- Users table extending auth.users
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'associate',
  name TEXT NOT NULL,
  franchise_partner_id UUID -- null if not a franchise partner
);

-- Franchise Partners
CREATE TABLE public.franchise_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  agreement_type TEXT NOT NULL,
  fee_split_pct NUMERIC NOT NULL
);

-- Deals
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  funding_stage TEXT NOT NULL,
  source TEXT NOT NULL,
  referring_partner_id UUID REFERENCES public.franchise_partners(id),
  assignee_id UUID REFERENCES public.users(id),
  current_stage deal_stage NOT NULL DEFAULT 'New Lead',
  success_fee_pct NUMERIC,
  split_pct NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deal Stage History
CREATE TABLE public.deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_stage deal_stage,
  to_stage deal_stage NOT NULL,
  changed_by UUID REFERENCES public.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deal Notes
CREATE TABLE public.deal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deal Documents
CREATE TABLE public.deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Investors
CREATE TABLE public.investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  thesis TEXT,
  stage_pref TEXT,
  cheque_size_min NUMERIC,
  cheque_size_max NUMERIC
);

-- Fund Outreach
CREATE TABLE public.fund_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  status outreach_status NOT NULL DEFAULT 'Sent',
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Memos
CREATE TABLE public.memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  status memo_status NOT NULL DEFAULT 'Draft',
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- RLS Setup
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchise_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;

-- Note: Proper RLS policies need to be defined according to the PRD in the next migration step.
