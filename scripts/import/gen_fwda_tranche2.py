import openpyxl

WB = r"C:\Users\upadh\Downloads\Syndicate_Investments 2024 Onwards.xlsx"
wb = openpyxl.load_workbook(WB, data_only=True, read_only=True)
rows = list(wb['FWDA'].iter_rows(min_row=1, max_row=40, values_only=True))

num = lambda v: float(v) if isinstance(v, (int, float)) else 0.0
q = lambda s: "'" + str(s).replace("'", "''").strip() + "'"

POC = {'PJ': 'piyush', 'PR': 'prashant', 'RD': 'ritu', 'WFC': 'wfc', 'RO': 'robin', 'ESV': None}
CORP = {
    'Soonicorn Angels': 'angel_fund', 'Signal Ventures': 'angel_fund',
    'Nishant Syndicate': 'angel_fund', 'ESV Advisors LLP': 'family_office',
    'Veritas Infra': 'family_office', 'Deksha Design Studio(Veritas)': 'family_office',
}
# var, display name, transaction split %, success split %
PARTNERS = [
    ('piyush',   'Piyush Jain',       50, 50),
    ('prashant', 'Prashant Rathi',    50, 50),
    ('ritu',     'Ritu Diwan',        45,  0),
    ('wfc',      'WFC',                0,  0),
    ('soon',     'Soonicorn Angels',   0, 60),
    ('signal',   'Signal Ventures',    0, 60),
    ('nishant',  'Nishant Syndicate', 50,  0),
]
# Robin trades as Kautilya Consulting Group, which is why a name match for "robin"
# found nothing. The record exists, so it is referenced, never created.
ROBIN_PARTNER = 'c7487bcc-fccf-4954-8b1b-04649e3195e9'
TITLE = 'FWDA - Tranche 2'

# Three of the investors ARE partners, taking a cut of the fee on their own money.
# The sheet records their POC as ESV, which is true of who ran the relationship but
# would leave nothing rooting to them - so their 60%/50% would compute against a base
# of zero. Attributed to themselves so the share has something to be a share of.
SELF = {'Soonicorn Angels': 'soon', 'Signal Ventures': 'signal', 'Nishant Syndicate': 'nishant'}

recs = []
for i, row in enumerate(rows, 1):
    if i < 3:
        continue
    g = lambda k: row[k] if k < len(row) else None
    nm = g(2)
    if nm in (None, ''):
        continue
    nm = str(nm).strip()
    bank = num(g(7))
    if bank <= 0:
        continue
    recs.append(dict(name=nm, poc=str(g(3) or 'ESV').strip(), veh=str(g(4) or '').strip(),
                     amt=bank, trx=num(g(9)), suc=num(g(10)),
                     st=CORP.get(nm, 'angel_investor')))

# active_deal_investors is unique on (deal, investor), but the sheet lists Mohit
# Aggarwal twice - 5 L through Invstt and 30 L on the direct cap table, at different
# transaction rates. Merged into one commitment whose rate is blended so the fee
# amounts come out identical: 10,000 + 1,80,000 on 35,00,000 is 5.428571%.
merged = {}
order = []
for r in recs:
    k = r['name']
    if k not in merged:
        merged[k] = dict(r, veh=[r['veh']])
        order.append(k)
    else:
        m = merged[k]
        if m['poc'] != r['poc']:
            raise SystemExit("%s has two POCs (%s, %s) - decide which before importing"
                             % (k, m['poc'], r['poc']))
        m['amt'] += r['amt']
        m['trx'] += r['trx']
        m['suc'] += r['suc']
        m['veh'].append(r['veh'])
recs = [merged[k] for k in order]
for r in recs:
    r['veh'] = ' + '.join(dict.fromkeys(r['veh']))

o = []
w = o.append
w("-- =========================================================================")
w("-- IMPORT - FWDA, Tranche 2")
w("-- Source: 'Syndicate_Investments 2024 Onwards.xlsx', sheet 'FWDA'.")
w("--")
w("-- Generated from the workbook rather than transcribed, so the figures are the")
w("-- sheet's own. Re-runnable: it clears its own previous output first.")
w("--")
w("-- Investment amounts are MONEY IN BANK, not committed intent, because that is")
w("-- what every fee in the sheet is computed against. Two rows differ: Kusum Gupta")
w("-- (2 Cr intended, 90 L received) and Yash M (2 Cr intended, 1,99,83,483).")
w("--")
w("-- Fee rates are stored per investor, not per deal: the sheet charges 2% through")
w("-- Invstt (ESV's net of Invstt's own 2%), 6% on the direct cap table, and 5% for")
w("-- Kunjal P alone. Success is 4%, except Soonicorn and Signal at 5% with no")
w("-- transaction fee.")
w("-- =========================================================================")
w("DO $$")
w("DECLARE")
w("  v_org      UUID := '00000000-0000-0000-0000-000000000001';")
w("  v_user     UUID;")
w("  v_pipeline UUID; v_stage UUID; v_entry UUID; v_deal UUID;")
w("  v_inv UUID; v_adi UUID;")
w("  -- Robin, who trades as Kautilya Consulting Group.")
w("  v_robin UUID := '%s';" % ROBIN_PARTNER)
for var, _disp, _t, _s in PARTNERS:
    w("  v_%s UUID;" % var)

w("BEGIN")
w("  PERFORM set_config('app.applying_attribution', 'on', true);")
# Any founder/admin will do - v_user only fills created_by, which is nullable.
# public.users has no created_at, so there is nothing to order by.
w("  SELECT id INTO v_user FROM public.users")
w("   WHERE org_id = v_org AND role IN ('founder','admin') LIMIT 1;")
w("")
w("")
w("  -- Partners who are not onboarded yet: a partner record with no user attached.")
w("  -- users.franchise_partner_id links a person to one whenever they get an account,")
w("  -- and their earnings are already attributed by then.")
for var, disp, _t, _s in PARTNERS:
    w("  SELECT id INTO v_%s FROM public.franchise_partners WHERE org_id = v_org AND name = %s;" % (var, q(disp)))
    w("  IF v_%s IS NULL THEN" % var)
    w("    INSERT INTO public.franchise_partners (org_id, name, contact_name, contact_email,")
    w("           agreement_type, success_fee_split_pct, partner_tier)")
    w("    VALUES (v_org, %s, %s, '', 'Standard', %d, 'sgp') RETURNING id INTO v_%s;" % (q(disp), q(disp), _t, var))
    w("  END IF;")

w("")
w("  -- Clear a previous run of this import.")
w("  DELETE FROM public.active_deal_investor_fees f")
w("   USING public.active_deal_investors adi, public.active_deals d, public.pipeline_entries e")
w("   WHERE f.active_deal_investor_id = adi.id AND adi.active_deal_id = d.id")
w("     AND d.pipeline_entry_id = e.id AND e.title = %s;" % q(TITLE))
w("  DELETE FROM public.active_deal_investors adi")
w("   USING public.active_deals d, public.pipeline_entries e")
w("   WHERE adi.active_deal_id = d.id AND d.pipeline_entry_id = e.id AND e.title = %s;" % q(TITLE))
w("  DELETE FROM public.active_deal_partner_shares s")
w("   USING public.active_deals d, public.pipeline_entries e")
w("   WHERE s.active_deal_id = d.id AND d.pipeline_entry_id = e.id AND e.title = %s;" % q(TITLE))
w("  DELETE FROM public.active_deals d USING public.pipeline_entries e")
w("   WHERE d.pipeline_entry_id = e.id AND e.title = %s;" % q(TITLE))
w("  DELETE FROM public.pipeline_entries WHERE title = %s;" % q(TITLE))
w("")
w("  -- The deal card.")
w("  SELECT id INTO v_pipeline FROM public.pipelines")
w("   WHERE org_id = v_org AND name = 'Completed Syndicate Deals';")
w("  IF v_pipeline IS NULL THEN")
w("    INSERT INTO public.pipelines (org_id, name, description, created_by)")
w("    VALUES (v_org, 'Completed Syndicate Deals',")
w("            'Historical syndicate rounds imported from the 2024-onwards workbook.', v_user)")
w("    RETURNING id INTO v_pipeline;")
w("  END IF;")
w("  SELECT id INTO v_stage FROM public.pipeline_stages")
w("   WHERE pipeline_id = v_pipeline AND name = 'Accepted';")
w("  IF v_stage IS NULL THEN")
w("    INSERT INTO public.pipeline_stages (pipeline_id, name, color, position, stage_type)")
w("    VALUES (v_pipeline, 'Accepted', '#16a34a', 998, 'accepted') RETURNING id INTO v_stage;")
w("  END IF;")
w("")
w("  INSERT INTO public.pipeline_entries (pipeline_id, stage_id, title)")
w("  VALUES (v_pipeline, v_stage, %s) RETURNING id INTO v_entry;" % q(TITLE))
w("  INSERT INTO public.active_deals (pipeline_entry_id) VALUES (v_entry) RETURNING id INTO v_deal;")
w("")
w("  -- closed, and off the partner portal: the full cap table is internal. Partner")
w("  -- earnings are deliberately not gated by this - a partner is owed what they are")
w("  -- owed whether or not the deal page is open to them.")
w("  UPDATE public.active_deals")
w("     SET deal_state = 'closed', visible_to_partners = false, total_raise = 160000000")
w("   WHERE id = v_deal;")
w("")

seen = set()
for r in recs:
    pv = SELF.get(r['name'], POC.get(r['poc']))
    pvar = 'v_robin' if pv == 'robin' else ('v_%s' % pv if pv else 'NULL')
    w("  -- %s  (POC %s, %s)" % (r['name'], r['poc'], r['veh']))
    w("  SELECT id INTO v_inv FROM public.investors WHERE org_id = v_org AND name = %s;" % q(r['name']))
    if True:
        seen.add(r['name'])
        w("  IF v_inv IS NULL THEN")
        w("    INSERT INTO public.investors (org_id, name, service_type, country, import_source, created_by)")
        w("    VALUES (v_org, %s, %s, 'India', 'syndicate-workbook-2024', v_user)" % (q(r['name']), q(r['st'])))
        w("    RETURNING id INTO v_inv;")
        w("  END IF;")
        if pvar != 'NULL':
            w("  UPDATE public.investors SET referred_by_partner_id = %s" % pvar)
            w("   WHERE id = v_inv AND referred_by_investor_id IS NULL;")
    w("  INSERT INTO public.active_deal_investors")
    w("         (active_deal_id, investor_id, investment_amount, is_investing, is_referral, status)")
    w("  VALUES (v_deal, v_inv, %d, true, %s, 'funds_received') RETURNING id INTO v_adi;"
      % (round(r['amt']), 'true' if pv else 'false'))
    if r['trx'] > 0:
        w("  INSERT INTO public.active_deal_investor_fees")
        w("         (active_deal_investor_id, label, rate, is_enabled, fee_kind)")
        w("  VALUES (v_adi, 'Transaction Fee', %.6f, true, 'transaction');" % (r['trx'] / r['amt'] * 100))
    if r['suc'] > 0:
        w("  INSERT INTO public.active_deal_investor_fees")
        w("         (active_deal_investor_id, label, rate, is_enabled, fee_kind)")
        w("  VALUES (v_adi, 'Success Fee', %.6f, true, 'success');" % (r['suc'] / r['amt'] * 100))
    w("")

w("  -- What each partner takes of each fee on this deal. Robin takes a quarter of the")
w("  -- transaction fee and none of the success fee, which is why fee kinds exist.")
for var, disp, t, s in PARTNERS + [('robin', 'Robin', 25, 0)]:
    w("  INSERT INTO public.active_deal_partner_shares")
    w("         (active_deal_id, partner_id, org_id, base_type, split_pct,")
    w("          split_transaction_pct, split_success_pct)")
    w("  VALUES (v_deal, v_%s, v_org, 'referred', %d, %d, %d);  -- %s" % (var, t, t, s, disp))
w("")
w("  PERFORM set_config('app.applying_attribution', 'off', true);")
w("  RAISE NOTICE 'FWDA Tranche 2 imported: deal=%%, %d commitments', v_deal;" % len(recs))
w("END $$;")

sql = "\n".join(o) + "\n"
with open('import_fwda_tranche2.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
print("wrote import_fwda_tranche2.sql")
print("lines:", len(sql.splitlines()), "commitments:", len(recs), "distinct investors:", len(seen))
wb.close()
