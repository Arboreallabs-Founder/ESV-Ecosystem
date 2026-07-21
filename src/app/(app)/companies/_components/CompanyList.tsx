'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createCompany, syncCompaniesFromExisting } from '@/app/actions/companies'
import { COMPANY_STATUS_LABELS, COMPANY_STATUSES } from '@/lib/types'
import type { CompanyListItem, CompanyStatus } from '@/lib/types'
import FilterTabs from '@/app/_components/FilterTabs'
import Spinner from '@/app/_components/Spinner'
import { WikiButton } from '@/app/_components/WikiPanel'
import CompaniesImportModal from './CompaniesImportModal'
import { formatInr, initials, locationLabel } from './format'
import styles from '../companies.module.css'

export default function CompanyList({ companies }: { companies: CompanyListItem[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncing, startSync] = useTransition()

  function handleSync() {
    setSyncMsg(null)
    startSync(async () => {
      try {
        const { cards, deals, tagged } = await syncCompaniesFromExisting()
        const parts: string[] = []
        if (cards) parts.push(`${cards} Deal Desk card${cards === 1 ? '' : 's'}`)
        if (deals) parts.push(`${deals} deal${deals === 1 ? '' : 's'}`)
        if (tagged) parts.push(`tagged ${tagged} compan${tagged === 1 ? 'y' : 'ies'}`)
        setSyncMsg(parts.length === 0 ? 'Everything is already synced.' : `Synced ${parts.join(', ')}.`)
        router.refresh()
      } catch (e) { setSyncMsg((e as Error).message) }
    })
  }

  const filtered = useMemo(() => companies.filter((c) => {
    if (status !== 'all' && c.status !== status) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!`${c.name} ${c.one_liner ?? ''} ${c.sectors.join(' ')}`.toLowerCase().includes(q)) return false
    }
    return true
  }), [companies, search, status])

  const statusTabs = [
    { value: 'all', label: 'All', count: companies.length },
    ...COMPANY_STATUSES.map((s) => ({ value: s, label: COMPANY_STATUS_LABELS[s], count: companies.filter((c) => c.status === s).length })),
  ].filter((t) => t.value === 'all' || t.count > 0)

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 className={styles.pageTitle}>Companies</h1>
            <WikiButton sectionKey="companies" />
          </div>
          <p className={styles.pageSubtitle}>Startup database — the full profile behind each deal.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={styles.ghostBtn} onClick={handleSync} disabled={syncing} title="Backfill profiles from Deal Desk cards & active deals">
            {syncing ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} /> Syncing…</span> : '↻ Sync'}
          </button>
          <button className={styles.ghostBtn} onClick={() => setShowImport(true)}>Import CSV</button>
          <button className={styles.primaryBtn} onClick={() => setShowNew(true)}>+ New company</button>
        </div>
      </div>

      {syncMsg && <div className={styles.syncMsg}>{syncMsg}</div>}

      <div className={styles.listControls}>
        <input className={styles.search} placeholder="Search companies…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <FilterTabs tabs={statusTabs} value={status} onChange={setStatus} />

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No companies</div>
          <div>{companies.length === 0 ? 'Add your first company, or promote a Deal Desk card into a profile.' : 'Nothing matches your filters.'}</div>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((c) => (
            <Link key={c.id} href={`/companies/${c.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={`${styles.logo} ${c.logo_url ? styles.logoImg : ''}`}>{c.logo_url ? <img src={c.logo_url} alt="" /> : initials(c.name)}</div>
                <div className={styles.cardTopRight}>
                  <span className={`${styles.statusPill} ${styles[`status_${c.status}`]}`}>{COMPANY_STATUS_LABELS[c.status]}</span>
                  {c.has_active_deal && <span className={styles.activeDealTag}>Active Deal</span>}
                </div>
              </div>
              <div className={styles.cardName}>{c.name}</div>
              {c.one_liner && <div className={styles.cardOneLiner}>{c.one_liner}</div>}
              <div className={styles.cardMeta}>
                {c.stage && <span className={styles.metaChip}>{c.stage}</span>}
                {c.sectors[0] && <span className={styles.metaChip}>{c.sectors[0]}</span>}
                {c.arr_inr != null && <span className={styles.metaChip}>{formatInr(c.arr_inr)} ARR</span>}
              </div>
              <div className={styles.cardFoot}>{locationLabel(c.hq_city, c.hq_country)}</div>
            </Link>
          ))}
        </div>
      )}

      {showNew && <NewCompanyModal existingNames={companies.map((c) => c.name)} onClose={() => setShowNew(false)} onCreated={(id) => router.push(`/companies/${id}`)} />}
      {showImport && <CompaniesImportModal onClose={() => setShowImport(false)} onImported={() => router.refresh()} />}
    </div>
  )
}

function NewCompanyModal({ existingNames, onClose, onCreated }: { existingNames: string[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [oneLiner, setOneLiner] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<CompanyStatus>('prospect')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!name.trim()) { setError('Company name is required.'); return }
    startTransition(async () => {
      try {
        const id = await createCompany({ name, one_liner: oneLiner.trim() || null, website: website.trim() || null, status })
        onCreated(id)
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}><h2 className={styles.modalTitle}>New company</h2><button className={styles.closeBtn} onClick={onClose}>×</button></div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Name *</label>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            {name.trim() && existingNames.some((n) => n.toLowerCase() === name.trim().toLowerCase()) && (
              <div className={styles.dupWarn}>⚠ A company named &ldquo;{name.trim()}&rdquo; already exists. You can still create it.</div>
            )}
          </div>
          <div className={styles.field}><label className={styles.fieldLabel}>One-liner</label><input className={styles.input} value={oneLiner} onChange={(e) => setOneLiner(e.target.value)} placeholder="What they do, in a line" /></div>
          <div className={styles.field}><label className={styles.fieldLabel}>Website</label><input className={styles.input} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Status</label>
            <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as CompanyStatus)}>
              {COMPANY_STATUSES.map((s) => <option key={s} value={s}>{COMPANY_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Creating…</span> : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
