-- Excel-style company custom fields, part 2: per-field format settings.
--
-- One JSONB column rather than a column per setting, because which settings apply depends on the
-- type (decimals mean nothing on a dropdown). Shape, validated in src/lib/company-fields.ts:
--
--   numeric / percentage : { "decimals": 0-6, "thousands": true|false }
--   currency             : { "decimals": 0-6, "unit": "rupees" | "lakh" | "crore" }
--   select / multi_select: { "options": ["Seed", "Series A", ...] }
--
-- Values stay in company_field_values.value (TEXT) exactly as before, so existing fields and the
-- CSV/export paths are untouched: numbers are stored raw ("1234567.5"), formatting is display-only.

ALTER TABLE public.company_field_defs
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;
