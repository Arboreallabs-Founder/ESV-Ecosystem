'use client'

import { useState, useTransition } from 'react'
import { updateDeskDeal, withdrawDeskDeal, type DeskDealPatch } from '@/app/actions/deal-desk'
import { DESK_STAGES, DESK_VALUATION_TYPES, DESK_REVENUE_STATUSES } from '@/lib/types'
import type { DeskDeal } from '@/lib/types'
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
    }
    startTransition(async () => {
      try { await updateDeskDeal(deal.id, patch); onSaved(); onClose() }
      catch (e) { setError((e as Error).message) }
    })
  }

  function withdraw() {
    if (!confirm('Withdraw this deal? This permanently deletes the card.')) return
    startTransition(async () => {
      try { await withdrawDeskDeal(deal.id); onSaved(); onClose() }
      catch (e) { setError((e as Error).message) }
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
            <button className={styles.primaryBtn} onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
