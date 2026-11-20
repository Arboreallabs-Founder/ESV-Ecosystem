-- Excel-style company custom fields, part 1: the new field types.
--
-- Standalone because Postgres won't let a new enum value be used in the transaction that adds it;
-- 20261121000100 (the per-field format config) and the app reference these values.
--
--   currency      number, shown as ₹ with Indian grouping or in Lakh/Crore (config.unit)
--   select        one value from config.options
--   multi_select  several values from config.options; stored as a JSON array string
--   checkbox      'true' / 'false'
--   long_text     multi-line text
--   email, phone  validated text

ALTER TYPE public.company_field_type ADD VALUE IF NOT EXISTS 'currency';
ALTER TYPE public.company_field_type ADD VALUE IF NOT EXISTS 'select';
ALTER TYPE public.company_field_type ADD VALUE IF NOT EXISTS 'multi_select';
ALTER TYPE public.company_field_type ADD VALUE IF NOT EXISTS 'checkbox';
ALTER TYPE public.company_field_type ADD VALUE IF NOT EXISTS 'long_text';
ALTER TYPE public.company_field_type ADD VALUE IF NOT EXISTS 'email';
ALTER TYPE public.company_field_type ADD VALUE IF NOT EXISTS 'phone';
