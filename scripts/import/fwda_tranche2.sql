-- =========================================================================
-- IMPORT - FWDA, Tranche 2
-- Source: 'Syndicate_Investments 2024 Onwards.xlsx', sheet 'FWDA'.
--
-- Generated from the workbook rather than transcribed, so the figures are the
-- sheet's own. Re-runnable: it clears its own previous output first.
--
-- Investment amounts are MONEY IN BANK, not committed intent, because that is
-- what every fee in the sheet is computed against. Two rows differ: Kusum Gupta
-- (2 Cr intended, 90 L received) and Yash M (2 Cr intended, 1,99,83,483).
--
-- Fee rates are stored per investor, not per deal: the sheet charges 2% through
-- Invstt (ESV's net of Invstt's own 2%), 6% on the direct cap table, and 5% for
-- Kunjal P alone. Success is 4%, except Soonicorn and Signal at 5% with no
-- transaction fee.
-- =========================================================================
DO $$
DECLARE
  v_org      UUID := '00000000-0000-0000-0000-000000000001';
  v_user     UUID;
  v_pipeline UUID; v_stage UUID; v_entry UUID; v_deal UUID;
  v_inv UUID; v_adi UUID;
  -- Robin, who trades as Kautilya Consulting Group.
  v_robin UUID := 'c7487bcc-fccf-4954-8b1b-04649e3195e9';
  v_piyush UUID;
  v_prashant UUID;
  v_ritu UUID;
  v_wfc UUID;
  v_soon UUID;
  v_signal UUID;
  v_nishant UUID;
BEGIN
  PERFORM set_config('app.applying_attribution', 'on', true);
  SELECT id INTO v_user FROM public.users
   WHERE org_id = v_org AND role IN ('founder','admin') LIMIT 1;


  -- Partners who are not onboarded yet: a partner record with no user attached.
  -- users.franchise_partner_id links a person to one whenever they get an account,
  -- and their earnings are already attributed by then.
  SELECT id INTO v_piyush FROM public.franchise_partners WHERE org_id = v_org AND name = 'Piyush Jain';
  IF v_piyush IS NULL THEN
    INSERT INTO public.franchise_partners (org_id, name, contact_name, contact_email,
           agreement_type, success_fee_split_pct, partner_tier)
    VALUES (v_org, 'Piyush Jain', 'Piyush Jain', '', 'Standard', 50, 'sgp') RETURNING id INTO v_piyush;
  END IF;
  SELECT id INTO v_prashant FROM public.franchise_partners WHERE org_id = v_org AND name = 'Prashant Rathi';
  IF v_prashant IS NULL THEN
    INSERT INTO public.franchise_partners (org_id, name, contact_name, contact_email,
           agreement_type, success_fee_split_pct, partner_tier)
    VALUES (v_org, 'Prashant Rathi', 'Prashant Rathi', '', 'Standard', 50, 'sgp') RETURNING id INTO v_prashant;
  END IF;
  SELECT id INTO v_ritu FROM public.franchise_partners WHERE org_id = v_org AND name = 'Ritu Diwan';
  IF v_ritu IS NULL THEN
    INSERT INTO public.franchise_partners (org_id, name, contact_name, contact_email,
           agreement_type, success_fee_split_pct, partner_tier)
    VALUES (v_org, 'Ritu Diwan', 'Ritu Diwan', '', 'Standard', 45, 'sgp') RETURNING id INTO v_ritu;
  END IF;
  SELECT id INTO v_wfc FROM public.franchise_partners WHERE org_id = v_org AND name = 'WFC';
  IF v_wfc IS NULL THEN
    INSERT INTO public.franchise_partners (org_id, name, contact_name, contact_email,
           agreement_type, success_fee_split_pct, partner_tier)
    VALUES (v_org, 'WFC', 'WFC', '', 'Standard', 0, 'sgp') RETURNING id INTO v_wfc;
  END IF;
  SELECT id INTO v_soon FROM public.franchise_partners WHERE org_id = v_org AND name = 'Soonicorn Angels';
  IF v_soon IS NULL THEN
    INSERT INTO public.franchise_partners (org_id, name, contact_name, contact_email,
           agreement_type, success_fee_split_pct, partner_tier)
    VALUES (v_org, 'Soonicorn Angels', 'Soonicorn Angels', '', 'Standard', 0, 'sgp') RETURNING id INTO v_soon;
  END IF;
  SELECT id INTO v_signal FROM public.franchise_partners WHERE org_id = v_org AND name = 'Signal Ventures';
  IF v_signal IS NULL THEN
    INSERT INTO public.franchise_partners (org_id, name, contact_name, contact_email,
           agreement_type, success_fee_split_pct, partner_tier)
    VALUES (v_org, 'Signal Ventures', 'Signal Ventures', '', 'Standard', 0, 'sgp') RETURNING id INTO v_signal;
  END IF;
  SELECT id INTO v_nishant FROM public.franchise_partners WHERE org_id = v_org AND name = 'Nishant Syndicate';
  IF v_nishant IS NULL THEN
    INSERT INTO public.franchise_partners (org_id, name, contact_name, contact_email,
           agreement_type, success_fee_split_pct, partner_tier)
    VALUES (v_org, 'Nishant Syndicate', 'Nishant Syndicate', '', 'Standard', 50, 'sgp') RETURNING id INTO v_nishant;
  END IF;

  -- Clear a previous run of this import.
  DELETE FROM public.active_deal_investor_fees f
   USING public.active_deal_investors adi, public.active_deals d, public.pipeline_entries e
   WHERE f.active_deal_investor_id = adi.id AND adi.active_deal_id = d.id
     AND d.pipeline_entry_id = e.id AND e.title = 'FWDA - Tranche 2';
  DELETE FROM public.active_deal_investors adi
   USING public.active_deals d, public.pipeline_entries e
   WHERE adi.active_deal_id = d.id AND d.pipeline_entry_id = e.id AND e.title = 'FWDA - Tranche 2';
  DELETE FROM public.active_deal_partner_shares s
   USING public.active_deals d, public.pipeline_entries e
   WHERE s.active_deal_id = d.id AND d.pipeline_entry_id = e.id AND e.title = 'FWDA - Tranche 2';
  DELETE FROM public.active_deals d USING public.pipeline_entries e
   WHERE d.pipeline_entry_id = e.id AND e.title = 'FWDA - Tranche 2';
  DELETE FROM public.pipeline_entries WHERE title = 'FWDA - Tranche 2';

  -- The deal card.
  SELECT id INTO v_pipeline FROM public.pipelines
   WHERE org_id = v_org AND name = 'Completed Syndicate Deals';
  IF v_pipeline IS NULL THEN
    INSERT INTO public.pipelines (org_id, name, description, created_by)
    VALUES (v_org, 'Completed Syndicate Deals',
            'Historical syndicate rounds imported from the 2024-onwards workbook.', v_user)
    RETURNING id INTO v_pipeline;
  END IF;
  SELECT id INTO v_stage FROM public.pipeline_stages
   WHERE pipeline_id = v_pipeline AND name = 'Accepted';
  IF v_stage IS NULL THEN
    INSERT INTO public.pipeline_stages (pipeline_id, name, color, position, stage_type)
    VALUES (v_pipeline, 'Accepted', '#16a34a', 998, 'accepted') RETURNING id INTO v_stage;
  END IF;

  INSERT INTO public.pipeline_entries (pipeline_id, stage_id, title)
  VALUES (v_pipeline, v_stage, 'FWDA - Tranche 2') RETURNING id INTO v_entry;
  INSERT INTO public.active_deals (pipeline_entry_id) VALUES (v_entry) RETURNING id INTO v_deal;

  -- closed, and off the partner portal: the full cap table is internal. Partner
  -- earnings are deliberately not gated by this - a partner is owed what they are
  -- owed whether or not the deal page is open to them.
  UPDATE public.active_deals
     SET deal_state = 'closed', visible_to_partners = false, total_raise = 160000000
   WHERE id = v_deal;

  -- Jyot Jumani  (POC ESV, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Jyot Jumani';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Jyot Jumani', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 500000, true, false, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Sandeep Sharma  (POC PR, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Sandeep Sharma';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Sandeep Sharma', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_prashant
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 500000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Aniket Wagh  (POC ESV, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Aniket Wagh';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Aniket Wagh', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, false, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Shilpi Bansal  (POC PR, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Shilpi Bansal';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Shilpi Bansal', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_prashant
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 500000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Sanjib Choudhary  (POC PR, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Sanjib Choudhary';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Sanjib Choudhary', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_prashant
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 500000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Akshat Loyalka  (POC PR, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Akshat Loyalka';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Akshat Loyalka', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_prashant
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 500000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Ravi Bhatia  (POC PR, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Ravi Bhatia';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Ravi Bhatia', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_prashant
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- aditya kumar dalmia  (POC PR, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'aditya kumar dalmia';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'aditya kumar dalmia', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_prashant
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Kanak Daga  (POC PR, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Kanak Daga';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Kanak Daga', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_prashant
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 550000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Mohit Aggarwal  (POC ESV, Invstt + Direct Cap table)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Mohit Aggarwal';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Mohit Aggarwal', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 3500000, true, false, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 5.428571, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Reetu Diwan  (POC RD, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Reetu Diwan';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Reetu Diwan', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_ritu
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Hiral Shah  (POC RD, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Hiral Shah';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Hiral Shah', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_ritu
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Keval Parikh  (POC RD, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Keval Parikh';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Keval Parikh', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_ritu
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Kunjlata Diwan  (POC RD, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Kunjlata Diwan';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Kunjlata Diwan', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_ritu
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Ekta Shah  (POC RD, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Ekta Shah';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Ekta Shah', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_ritu
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Shyam Gandhi  (POC RD, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Shyam Gandhi';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Shyam Gandhi', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_ritu
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Safal Mehta  (POC RD, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Safal Mehta';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Safal Mehta', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_ritu
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Rajeev Sagar  (POC PJ, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Rajeev Sagar';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Rajeev Sagar', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_piyush
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Abhishek Singhi  (POC PJ, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Abhishek Singhi';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Abhishek Singhi', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_piyush
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Pooja Chawla  (POC ESV, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Pooja Chawla';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Pooja Chawla', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 500000, true, false, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Vivek Agarwal  (POC WFC, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Vivek Agarwal';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Vivek Agarwal', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_wfc
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Sarvesh Kumar Mishra  (POC WFC, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Sarvesh Kumar Mishra';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Sarvesh Kumar Mishra', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_wfc
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Jitendra Mahapatra  (POC WFC, Invstt)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Jitendra Mahapatra';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Jitendra Mahapatra', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_wfc
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 300000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 2.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Kunjal P  (POC ESV, Direct Cap table)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Kunjal P';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Kunjal P', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 10000000, true, false, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 5.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Kusum Gutpa  (POC ESV, Direct Cap table)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Kusum Gutpa';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Kusum Gutpa', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 9000000, true, false, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 6.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Yash M  (POC RD, Direct Cap table)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Yash M';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Yash M', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_ritu
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 19983483, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 6.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Nancy Jain  (POC PJ, Direct Cap table)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Nancy Jain';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Nancy Jain', 'angel_investor', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_piyush
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 5000000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 6.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Soonicorn Angels  (POC ESV, Soonicorn Angels)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Soonicorn Angels';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Soonicorn Angels', 'angel_fund', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_soon
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 5500000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 5.000000, true, 'success');

  -- Veritas Infra  (POC RO, Direct Cap table)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Veritas Infra';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Veritas Infra', 'family_office', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_robin
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 7500000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 6.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Signal Ventures  (POC ESV, Signal Ventures)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Signal Ventures';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Signal Ventures', 'angel_fund', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_signal
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 20000000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 5.000000, true, 'success');

  -- Nishant Syndicate  (POC ESV, Nishant Syndicate)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Nishant Syndicate';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Nishant Syndicate', 'angel_fund', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_nishant
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 3000000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 6.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- ESV Advisors LLP  (POC ESV, Direct Cap table)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'ESV Advisors LLP';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'ESV Advisors LLP', 'family_office', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 4800000, true, false, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 6.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- Deksha Design Studio(Veritas)  (POC RO, Direct Cap table)
  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = 'Deksha Design Studio(Veritas)';
  IF v_inv IS NULL THEN
    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)
    VALUES (v_org, 'Deksha Design Studio(Veritas)', 'family_office', 'India', 'syndicate-workbook-2024', v_user)
    RETURNING id INTO v_inv;
  END IF;
  UPDATE public.investors SET referred_by_partner_id = v_robin
   WHERE id = v_inv AND referred_by_investor_id IS NULL;
  INSERT INTO public.active_deal_investors
         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)
  VALUES (v_deal, v_inv, 3000000, true, true, 'funds_received') RETURNING id INTO v_adi;
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Transaction Fee', 6.000000, true, 'transaction');
  INSERT INTO public.active_deal_investor_fees
         (active_deal_investor_id, label, rate, is_enabled, fee_kind)
  VALUES (v_adi, 'Success Fee', 4.000000, true, 'success');

  -- What each partner takes of each fee on this deal. Robin takes a quarter of the
  -- transaction fee and none of the success fee, which is why fee kinds exist.
  INSERT INTO public.active_deal_partner_shares
         (active_deal_id, partner_id, org_id, base_type, split_pct,
          split_transaction_pct, split_success_pct)
  VALUES (v_deal, v_piyush, v_org, 'referred', 50, 50, 50);  -- Piyush Jain
  INSERT INTO public.active_deal_partner_shares
         (active_deal_id, partner_id, org_id, base_type, split_pct,
          split_transaction_pct, split_success_pct)
  VALUES (v_deal, v_prashant, v_org, 'referred', 50, 50, 50);  -- Prashant Rathi
  INSERT INTO public.active_deal_partner_shares
         (active_deal_id, partner_id, org_id, base_type, split_pct,
          split_transaction_pct, split_success_pct)
  VALUES (v_deal, v_ritu, v_org, 'referred', 45, 45, 0);  -- Ritu Diwan
  INSERT INTO public.active_deal_partner_shares
         (active_deal_id, partner_id, org_id, base_type, split_pct,
          split_transaction_pct, split_success_pct)
  VALUES (v_deal, v_wfc, v_org, 'referred', 0, 0, 0);  -- WFC
  INSERT INTO public.active_deal_partner_shares
         (active_deal_id, partner_id, org_id, base_type, split_pct,
          split_transaction_pct, split_success_pct)
  VALUES (v_deal, v_soon, v_org, 'referred', 0, 0, 60);  -- Soonicorn Angels
  INSERT INTO public.active_deal_partner_shares
         (active_deal_id, partner_id, org_id, base_type, split_pct,
          split_transaction_pct, split_success_pct)
  VALUES (v_deal, v_signal, v_org, 'referred', 0, 0, 60);  -- Signal Ventures
  INSERT INTO public.active_deal_partner_shares
         (active_deal_id, partner_id, org_id, base_type, split_pct,
          split_transaction_pct, split_success_pct)
  VALUES (v_deal, v_nishant, v_org, 'referred', 50, 50, 0);  -- Nishant Syndicate
  INSERT INTO public.active_deal_partner_shares
         (active_deal_id, partner_id, org_id, base_type, split_pct,
          split_transaction_pct, split_success_pct)
  VALUES (v_deal, v_robin, v_org, 'referred', 25, 25, 0);  -- Robin

  PERFORM set_config('app.applying_attribution', 'off', true);
  RAISE NOTICE 'FWDA Tranche 2 imported: deal=%, 33 commitments', v_deal;
END $$;
