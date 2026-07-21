-- Optional logo image (URL) shown on the Active Deals board and detail page.
ALTER TABLE public.active_deals
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
