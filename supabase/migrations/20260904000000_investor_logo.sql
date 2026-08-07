-- A logo for each investor.
--
-- Stored as a URL, and mirrored into our own bucket at save time by the existing image-cache
-- helper — the same path user avatars and company founder photos already take.
--
-- Mirroring is not about cost. Avatars render with a plain <img>, so Next.js image optimisation is
-- never invoked and no Vercel transformation quota is consumed; bytes go browser → Supabase CDN
-- and the Next server is not in the path. Storage is not the constraint either: 434 investors at a
-- pessimistic 60 KB each is 25 MB against a 1 GB free tier.
--
-- It is about rot. LinkedIn and most social CDNs serve signed, time-limited media URLs: paste one
-- and the logo works today, then quietly 404s in a few weeks. Mirroring once gives a permanent URL
-- with a one-year cache-control, so repeat views re-fetch nothing.

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN public.investors.logo_url IS
  'Mirrored into the cached-images bucket at save time; never a hotlink to a third-party CDN.';
