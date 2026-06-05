-- Add fixed_fee to franchise_partners (flat fee per closed deal in INR)
ALTER TABLE public.franchise_partners
  ADD COLUMN IF NOT EXISTS fixed_fee NUMERIC(14, 2) DEFAULT 0 NOT NULL;

-- Add deal-level fixed fee override (null = use partner default)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS partner_fixed_fee NUMERIC(14, 2) DEFAULT NULL;

COMMENT ON COLUMN public.franchise_partners.fixed_fee IS 'Flat fee in INR paid to partner per successfully closed deal';
COMMENT ON COLUMN public.franchise_partners.fee_split_pct IS 'Variable fee: % of ESV success fee paid to partner';
COMMENT ON COLUMN public.deals.partner_fixed_fee IS 'Deal-specific override for partner fixed fee (null = use partner default)';
COMMENT ON COLUMN public.deals.split_pct IS 'Deal-specific override for partner variable split % (null = use partner default)';
