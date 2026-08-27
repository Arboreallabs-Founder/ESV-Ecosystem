'use client'

import { describeError } from '@/lib/client-errors'
import { useState, useTransition } from 'react'
import { updateDeskDeal, withdrawDeskDeal, type DeskDealPatch } from '@/app/actions/deal-desk'
import { DESK_STAGES, DESK_VALUATION_TYPES, DESK_REVENUE_STATUSES, DESK_INSTRUMENTS, DESK_ROUND_STATUSES } from '@/lib/types'
import type { DeskDeal } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import styles from './deal-desk.module.css'

// Lightweight author edit for the most-changed fields + withdraw. Full structured data
// (founders, cap table, revenue series) comes from the CSV; re-import to change those.
export default function DealEditModal({ deal, onClose, onSaved }: { deal: DeskDeal; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    company_name: deal.company_name,
    sector: deal.sector ?? '',
    about: deal.about ?? '',
    location: deal.location ?? '',
    stage: deal.stage ?? '',
    ask_inr: deal.ask_inr?.toString() ?? '',
    valuation_type: deal.valuation_type ?? '',
    valuation_inr: deal.valuation_inr?.toString() ?? '',
    dilution_percent: deal.dilution_percent?.toString() ?? '',
    revenue_status: deal.revenue_status ?? '',
    usp: deal.usp ?? '',
    notes: deal.notes ?? '',
    pitch_deck_url: deal.pitch_deck_url ?? '',
    analyst_opinion: deal.analyst_opinion ?? '',
    referrer: deal.referrer ?? '',
    business_model: deal.business_model ?? '',
    instrument: deal.instrument ?? '',
    round_status: deal.round_status ?? '',
    committed_inr: deal.committed_inr?.toString() ?? '',
    total_raised_inr: deal.total_raised_inr?.toString() ?? '',
    gross_margin_pct: deal.gross_margin_pct?.toString() ?? '',
    monthly_burn_inr: deal.monthly_burn_inr?.toString() ?? '',
    runway_months: deal.runway_months?.toString() ?? '',
    customers_count: deal.customers_count?.toString() ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const num = (v: string): number | null => (v.trim() === '' ? null : Number(v))

  function save() {
    setError(null)
    if (!form.company_name.trim()) { setError('Company name is required.'); return }
    if (form.ask_inr && Number.isNaN(Number(form.ask_inr))) { setError('Ask must be a number.'); return }
    const patch: DeskDealPatch = {
      company_name: form.company_name,
      sector: form.sector.trim() || null,
      about: form.about.trim() || null,
      location: form.location.trim() || null,
      stage: (form.stage || null) as DeskDealPatch['stage'],
      ask_inr: num(form.ask_inr),
      valuation_type: (form.valuation_type || null) as DeskDealPatch['valuation_type'],
      valuation_inr: form.valuation_type === 'TBD' ? null : num(form.valuation_inr),
      dilution_percent: num(form.dilution_percent),
      revenue_status: (form.revenue_status || null) as DeskDealPatch['revenue_status'],
      usp: form.usp.trim() || null,
      notes: form.notes.trim() || null,
      pitch_deck_url: form.pitch_deck_url.trim() || null,
      analyst_opinion: form.analyst_opinion.trim() || null,
      referrer: form.referrer.trim() || null,
      business_model: form.business_model.trim() || null,
      instrument: (form.instrument || null) as DeskDealPatch['instrument'],
      round_status: (form.round_status || null) as DeskDealPatch['round_status'],
      committed_inr: num(form.committed_inr),
      total_raised_inr: num(form.total_raised_inr),
      gross_margin_pct: num(form.gross_margin_pct),
      monthly_burn_inr: num(form.monthly_burn_inr),
      runway_months: num(form.runway_months),
      customers_count: num(form.customers_count),
    }
    startTransition(async () => {
      try { await updateDeskDeal(deal.id, patch); onSaved(); onClose() }
      catch (e) { setError(describeError(e).message) }
    })
  }

  function withdraw() {
    if (!confirm('Withdraw this deal? This permanently deletes the card.')) return
    startTransition(async () => {
      try { await withdrawDeskDeal(deal.id); onSaved(); onClose() }
      catch (e) { setError(describeError(e).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Edit deal</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Company name (max 40)</label>
            <input className={styles.input} maxLength={40} value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Sector</label>
              <input className={styles.input} value={form.sector} onChange={(e) => set('sector', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Stage</label>
              <select className={styles.select} value={form.stage} onChange={(e) => set('stage', e.target.value)}>
                <option value="">—</option>
                {DESK_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>About (max 50)</label>
            <input className={styles.input} maxLength={50} value={form.about} onChange={(e) => set('about', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Location (max 50)</label>
            <input className={styles.input} maxLength={50} value={form.location} onChange={(e) => set('location', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Ask (₹)</label>
              <input className={styles.input} inputMode="numeric" value={form.ask_inr} onChange={(e) => set('ask_inr', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Valuation</label>
              <select className={styles.select} value={form.valuation_type} onChange={(e) => set('valuation_type', e.target.value)}>
                <option value="">—</option>
                {DESK_VALUATION_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Dilution (%)</label>
              <input className={styles.input} inputMode="numeric" value={form.dilution_percent} onChange={(e) => set('dilution_percent', e.target.value)} />
            </div>
          </div>
          {form.valuation_type === 'Fixed' && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Valuation amount (₹)</label>
              <input className={styles.input} inputMode="numeric" value={form.valuation_inr} onChange={(e) => set('valuation_inr', e.target.value)} />
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Revenue status</label>
            <select className={styles.select} value={form.revenue_status} onChange={(e) => set('revenue_status', e.target.value)}>
              <option value="">—</option>
              {DESK_REVENUE_STATUSES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>USP</label>
            <input className={styles.input} value={form.usp} onChange={(e) => set('usp', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Pitch deck URL</label>
            <input className={styles.input} value={form.pitch_deck_url} onChange={(e) => set('pitch_deck_url', e.target.value)} />
          </div>

          <div className={styles.sectionLabel} style={{ margin: '0.5rem 0 0.6rem' }}>Deal terms</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Business model</label>
              <input className={styles.input} value={form.business_model} onChange={(e) => set('business_model', e.target.value)} placeholder="e.g. B2B SaaS" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Instrument</label>
              <select className={styles.select} value={form.instrument} onChange={(e) => set('instrument', e.target.value)}>
                <option value="">—</option>
                {DESK_INSTRUMENTS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Round status</label>
              <select className={styles.select} value={form.round_status} onChange={(e) => set('round_status', e.target.value)}>
                <option value="">—</option>
                {DESK_ROUND_STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Committed so far (₹)</label>
              <input className={styles.input} inputMode="numeric" value={form.committed_inr} onChange={(e) => set('committed_inr', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Total raised to date (₹)</label>
              <input className={styles.input} inputMode="numeric" value={form.total_raised_inr} onChange={(e) => set('total_raised_inr', e.target.value)} />
            </div>
          </div>

          <div className={styles.sectionLabel} style={{ margin: '0.5rem 0 0.6rem' }}>Metrics</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Gross margin (%)</label>
              <input className={styles.input} inputMode="numeric" value={form.gross_margin_pct} onChange={(e) => set('gross_margin_pct', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Monthly burn (₹)</label>
              <input className={styles.input} inputMode="numeric" value={form.monthly_burn_inr} onChange={(e) => set('monthly_burn_inr', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Runway (months)</label>
              <input className={styles.input} inputMode="numeric" value={form.runway_months} onChange={(e) => set('runway_months', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Customers</label>
              <input className={styles.input} inputMode="numeric" value={form.customers_count} onChange={(e) => set('customers_count', e.target.value)} />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Referrer</label>
            <input className={styles.input} value={form.referrer} onChange={(e) => set('referrer', e.target.value)} placeholder="Who referred / sourced this deal" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Analyst&rsquo;s opinion (max 100)</label>
            <textarea className={styles.textarea} maxLength={100} value={form.analyst_opinion} onChange={(e) => set('analyst_opinion', e.target.value)} placeholder="Your quick take on this deal…" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Notes</label>
            <textarea className={styles.textarea} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border)' }}>
          <button className={styles.ghostBtn} onClick={withdraw} disabled={pending} style={{ color: 'var(--color-destructive)' }}>Withdraw</button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
            <button className={styles.primaryBtn} onClick={save} disabled={pending}>
              {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
