-- Events (previously mixed into Bulletin Board) get two dedicated link fields instead of
-- the generic "supporting media" list: a Google link for event media, and a separate
-- Drive link for scanned business cards collected at the event.
ALTER TABLE public.bulletin_posts
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS scanned_cards_url TEXT;
