'use client'

import { useState, useTransition } from 'react'
import { updateCompany, setFieldValue, addUpdate, type CompanyPatch } from '@/app/actions/companies'
import type { Company, CompanyFieldDef, CompanyFounder } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import { SpecField, OVERVIEW_SPECS, TRACTION_SPECS, RAISE_SPECS, PRODUCT_SPECS, initValue, coerce, type Spec } from './field-specs'
import styles from '../companies.module.css'

type Team = Array<{ id: string; name: string }>

const SECTIONS: Array<{ key: string; title: string; specs: Spec[] }> = [
  { key: 'overview', title: 'Overview', specs: OVERVIEW_SPECS },
  { key: 'traction', title: 'Traction & metrics', specs: TRACTION_SPECS },
  { key: 'raise', title: 'Current raise', specs: RAISE_SPECS },
  { key: 'product', title: 'Product', specs: PRODUCT_SPECS },
]

type FounderRow = { name: string; role: string; linkedin_url: string; ex_affiliations: string; photo_url: string; equity_pct: string; bio: string }
const emptyFounder = (): FounderRow => ({ name: '', role: '', linkedin_url: '', ex_affiliations: '', photo_url: '', equity_pct: '', bio: '' })

export default function CallUpdateModal({ company, fieldDefs, teamMembers, onClose, onSaved }: {
  company: Company; fieldDefs: CompanyFieldDef[]; teamMembers: Team; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {}
    for (const sec of SECTIONS) for (const s of sec.specs) f[s.key as string] = initValue(company, s)
    return f
  })
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [founders, setFounders] = useState<FounderRow[]>(() =>
    company.founders.length > 0
      ? company.founders.map((f) => ({
          name: f.name ?? '', role: f.role ?? '', linkedin_url: f.linkedin_url ?? '',
          ex_affiliations: f.ex_affiliations ?? '', photo_url: f.photo_url ?? '',
          equity_pct: f.equity_pct != null ? String(f.equity_pct) : '', bio: f.bio ?? '',
        }))
      : [emptyFounder()],
  )
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const def of fieldDefs) v[def.id] = company.field_values.find((fv) => fv.field_def_id === def.id)?.value ?? ''
    return v
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const setNote = (key: string, v: string) => setNotes((n) => ({ ...n, [key]: v }))
  const setFounder = (i: number, k: keyof FounderRow, v: string) => setFounders((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)))
  const addFounderRow = () => setFounders((r) => [...r, emptyFounder()])
  const removeFounderRow = (i: number) => setFounders((r) => r.filter((_, idx) => idx !== i))

  function save() {
    setError(null)
    const patch: Record<string, unknown> = {}
    for (const sec of SECTIONS) for (const s of sec.specs) patch[s.key as string] = coerce(form[s.key as string] ?? '', s.type)
    if (!(patch.name as string | null)) { setError('Company name is required.'); return }

    const cleanedFounders: CompanyFounder[] = founders
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(), role: r.role.trim() || null, bio: r.bio.trim() || null,
        ex_affiliations: r.ex_affiliations.trim() || null, linkedin_url: r.linkedin_url.trim() || null,
        photo_url: r.photo_url.trim() || null, equity_pct: r.equity_pct.trim() ? Number(r.equity_pct) : null,
      }))
    patch.founders = cleanedFounders

    startTransition(async () => {
      try {
        await updateCompany(company.id, patch as CompanyPatch)

        for (const def of fieldDefs) {
          const v = customValues[def.id] ?? ''
          const cur = company.field_values.find((fv) => fv.field_def_id === def.id)?.value ?? ''
          if (v !== cur) await setFieldValue(company.id, def.id, v)
        }

        const noteBlocks = SECTIONS
          .map((sec) => ({ title: sec.title, text: (notes[sec.key] ?? '').trim() }))
          .filter((b) => b.text)
        const founderNote = (notes.founders ?? '').trim()
        if (founderNote) noteBlocks.push({ title: 'Founders', text: founderNote })
        if (noteBlocks.length > 0) {
          const combined = `Call notes\n\n${noteBlocks.map((b) => `${b.title}: ${b.text}`).join('\n\n')}`
          await addUpdate(company.id, combined)
        }

        onSaved(); onClose()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={`${styles.modal} ${styles.modalXWide}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Update from call</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.sectionText} style={{ marginBottom: '1rem' }}>
            One place to capture everything from the call. Fill in what came up, add a note under any
            section for context that doesn&rsquo;t fit a field, and save once.
          </p>

          {SECTIONS.map((sec) => (
            <div key={sec.key} className={styles.callSection}>
              <div className={styles.callSectionTitle}>{sec.title}</div>
              <div className={styles.formGrid2}>
                {sec.specs.map((s) => (
                  <div key={s.key as string} style={s.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
                    <SpecField spec={s} value={form[s.key as string] ?? ''} onChange={(v) => set(s.key as string, v)} team={teamMembers} />
                  </div>
                ))}
              </div>
              <div className={styles.field} style={{ marginTop: '0.4rem' }}>
                <label className={styles.fieldLabel}>Notes</label>
                <textarea
                  className={styles.textarea}
                  placeholder={`Anything else from the call about ${sec.title.toLowerCase()}…`}
                  value={notes[sec.key] ?? ''}
                  onChange={(e) => setNote(sec.key, e.target.value)}
                />
              </div>
            </div>
          ))}

          {/* Founders */}
          <div className={styles.callSection}>
            <div className={styles.callSectionTitle}>Founders</div>
            {founders.map((r, i) => (
              <div key={i} className={styles.repeatRow}>
                <div className={styles.repeatGrid}>
                  <input className={styles.input} placeholder="Name" value={r.name} onChange={(e) => setFounder(i, 'name', e.target.value)} />
                  <input className={styles.input} placeholder="Role" value={r.role} onChange={(e) => setFounder(i, 'role', e.target.value)} />
                  <input className={styles.input} placeholder="LinkedIn URL" value={r.linkedin_url} onChange={(e) => setFounder(i, 'linkedin_url', e.target.value)} />
                  <input className={styles.input} placeholder="Ex-affiliations" value={r.ex_affiliations} onChange={(e) => setFounder(i, 'ex_affiliations', e.target.value)} />
                  <input className={styles.input} placeholder="Photo URL" value={r.photo_url} onChange={(e) => setFounder(i, 'photo_url', e.target.value)} />
                  <input className={styles.input} placeholder="Equity %" inputMode="numeric" value={r.equity_pct} onChange={(e) => setFounder(i, 'equity_pct', e.target.value)} />
                  <input className={styles.input} placeholder="Bio" value={r.bio} onChange={(e) => setFounder(i, 'bio', e.target.value)} />
                </div>
                <button className={styles.rowRemove} onClick={() => removeFounderRow(i)} title="Remove">×</button>
              </div>
            ))}
            <button className={styles.ghostBtn} onClick={addFounderRow}>+ Add founder</button>
            <div className={styles.field} style={{ marginTop: '0.6rem' }}>
              <label className={styles.fieldLabel}>Notes</label>
              <textarea className={styles.textarea} placeholder="Anything else about the founders/team…" value={notes.founders ?? ''} onChange={(e) => setNote('founders', e.target.value)} />
            </div>
          </div>

          {/* Custom fields */}
          {fieldDefs.length > 0 && (
            <div className={styles.callSection}>
              <div className={styles.callSectionTitle}>Custom fields</div>
              <div className={styles.formGrid2}>
                {fieldDefs.map((def) => (
                  <div key={def.id} className={styles.field}>
                    <label className={styles.fieldLabel}>{def.label}</label>
                    <input
                      className={styles.input}
                      type={def.field_type === 'date' ? 'date' : def.field_type === 'url' ? 'url' : 'text'}
                      inputMode={def.field_type === 'numeric' || def.field_type === 'percentage' ? 'numeric' : undefined}
                      value={customValues[def.id] ?? ''}
                      onChange={(e) => setCustomValues((v) => ({ ...v, [def.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={save} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : 'Save all'}
          </button>
        </div>
      </div>
    </div>
  )
}
