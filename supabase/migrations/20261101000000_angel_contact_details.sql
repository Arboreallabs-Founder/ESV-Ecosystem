-- An email and a WhatsApp number on the angel investor record.
--
-- Funds have their people in investor_contacts. An angel is the person, so their own way of being
-- reached belongs on the record itself, next to the other angel-only fields (birthday, onboarding,
-- KYC). The app shows and edits these only when service_type = 'angel_investor'.

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

COMMENT ON COLUMN public.investors.email IS 'Angel investors: their email address.';
COMMENT ON COLUMN public.investors.whatsapp_phone IS
  'Angel investors: WhatsApp number, stored as typed (country code encouraged, e.g. +91 98765 43210).';

-- A loose shape check only: something@something. Anything stricter refuses real addresses.
ALTER TABLE public.investors DROP CONSTRAINT IF EXISTS investors_email_shape;
ALTER TABLE public.investors ADD CONSTRAINT investors_email_shape
  CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+$');
