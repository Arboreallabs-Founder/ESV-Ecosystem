-- The partner form, rewritten for the person actually filling it in.
--
-- ─── What the founder was being told ────────────────────────────────────────
-- The description read: "Referred by one of our Strategic Growth Partners. Submissions arrive on
-- the Partner Sourced pipeline at Lead."
--
-- Both halves are ours, not theirs. A founder should not learn from a form that somebody was paid
-- to introduce them; that is a commercial arrangement between us and the partner, and putting it in
-- front of the founder changes how they read everything after it. The second sentence is worse in a
-- quieter way: "Partner Sourced pipeline at Lead" is the name of a board and a column in our CRM,
-- which means nothing to them and tells anyone curious how we file people.
--
-- The header also repeated the brand. FormRenderer already prints "Earlyseed Ventures" above the
-- title, so "Earlyseed Ventures — Startup Application" said it twice and used an em dash to do it.
--
-- No em dashes anywhere here, per instruction. The FY ranges used en dashes, which is conventional
-- typography and still not a hyphen, so those are hyphens now too.

UPDATE public.forms SET
  display_name = 'Startup Application',
  description  =
    'Tell us about your company and what you are raising. It takes about five minutes. '
    || 'Everything you write here goes straight to the team who will read it, and we will come back to you either way.'
WHERE is_partner_form;

-- ─── The questions ──────────────────────────────────────────────────────────
-- Matched on the existing text so both organisations' copies are updated by one statement, and so
-- re-running this migration is harmless once the text has changed.
--
-- Most of these are consistency rather than meaning: the form asked twenty-seven questions and then
-- three of them were bare labels ("Email", "Phone number", "Your full name"), which reads as a
-- different form having been pasted in halfway through.
UPDATE public.form_nodes SET question_text = 'What is your name?'
 WHERE question_text = 'Your full name';

UPDATE public.form_nodes SET question_text = 'What is your email address?'
 WHERE question_text = 'Email';

UPDATE public.form_nodes SET question_text = 'What is your phone number?'
 WHERE question_text = 'Phone number';

UPDATE public.form_nodes SET question_text = 'What is your website or company LinkedIn page?'
 WHERE question_text = 'Link your website and/or company LinkedIn page';

UPDATE public.form_nodes SET question_text = 'What is your LinkedIn profile?'
 WHERE question_text = 'Please link your personal LinkedIn profile';

UPDATE public.form_nodes SET question_text = 'Which sector does your startup operate in?'
 WHERE question_text = 'What sector is your startup operating in?';

-- Was "And a second sector, if the business spans two." — a sentence fragment where every
-- neighbour is a question, so it read as an instruction the reader had already missed.
UPDATE public.form_nodes SET question_text = 'Is there a second sector it operates in?'
 WHERE question_text = 'And a second sector, if the business spans two.';

UPDATE public.form_nodes SET question_text = 'What was your turnover in the last completed financial year, FY 2025-26? (INR)'
 WHERE question_text LIKE 'What was your turnover for the last completed financial year%';

UPDATE public.form_nodes SET question_text = 'What is your revenue so far this financial year, FY 2026-27? (INR)'
 WHERE question_text LIKE 'What is your revenue so far this financial year%';

UPDATE public.form_nodes SET question_text = 'What was your revenue in the most recent month you traded? (INR)'
 WHERE question_text = 'What was your revenue in the last operational month (in INR)?';

UPDATE public.form_nodes SET question_text = 'What valuation are you raising at? (INR)'
 WHERE question_text = 'What is the valuation of the current round (in INR)?';

UPDATE public.form_nodes SET question_text = 'How much are you raising? (INR)'
 WHERE question_text = 'How much do you want to raise in the current round (in INR)?';

UPDATE public.form_nodes SET question_text = 'Do you have any soft commitments so far, including government grants?'
 WHERE question_text = 'Have you received any soft commitments for the current round, including government grants?';

-- The em dash, and a sentence that had to carry an apology and an instruction at once.
UPDATE public.form_nodes SET question_text =
  'We are at capacity for new fundraising mandates at the moment. Our pre-funding services are still open, so choose Yes below if those would be useful.'
 WHERE question_text LIKE 'We are currently at capacity for fundraising mandates%';

UPDATE public.form_nodes SET question_text = 'Would our pre-funding services be useful to you?'
 WHERE question_text = 'Would you be interested in pre-funding services from Earlyseed Ventures?';

UPDATE public.form_nodes SET question_text =
  'Which pre-funding services do you need? For example a financial model, pitch deck, data room, valuation or company profile.'
 WHERE question_text LIKE 'Which pre-funding services do you need?%';

-- "What is the nature of your entity?" is the sort of phrase that belongs on a government form.
UPDATE public.form_nodes SET question_text = 'How is the company registered?'
 WHERE question_text = 'What is the nature of your entity?';

UPDATE public.form_nodes SET question_text = 'Do you need help incorporating?'
 WHERE question_text = 'Do you need help with business incorporation services?';

UPDATE public.form_nodes SET question_text = 'Which fundraising services would you like?'
 WHERE question_text = 'Which fundraising services do you need from Earlyseed Ventures?';

UPDATE public.form_nodes SET question_text = 'Would you like support with digital marketing?'
 WHERE question_text = 'Do you need support with digital marketing?';

UPDATE public.form_nodes SET question_text = 'Would you like to join a community of startup founders?'
 WHERE question_text = 'Would you like to be part of a startup founders'' community?';

UPDATE public.form_nodes SET question_text = 'Where can we find your pitch deck?'
 WHERE question_text = 'Please link the pitch deck for your startup.';
