'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { pocCoverage, SERVICE_TYPE_LABELS } from '@/lib/types'
import type { Investor, ServiceType } from '@/lib/types'
import InvestorCard from './InvestorCard'
import InvestorDetail from './InvestorDetail'
import InvestorFormModal from './InvestorFormModal'
import InvestorsImportModal from './InvestorsImportModal'
import FilterTabs from '@/app/_components/FilterTabs'
import styles from '../investors.module.css'

type Props = {
  investors: Investor[]
  userRole: string
  canManage?: boolean
  internalUsers: Array<{ id: string; name: string }>
  franchisePartners: Array<{ id: string; name: string }>
}

const ALL_TABS = ['all', 'vc_fund', 'angel_fund', 'family_office', 'angel_investor'] as const
type Tab = (typeof ALL_TABS)[number]

export default function InvestorGrid({ investors, userRole, canManage = true, internalUsers, franchisePartners }: Props) {
  const router = useRouter()
  const isInternal = ['founder', 'admin', 'associate', 'hr'].includes(userRole)
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Investor | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editTarget, setEditTarget] = useState<Investor | null>(null)
  // Off by default. It is a work queue, not a lens you want on every time you open the page.
  const [needsPocOnly, setNeedsPocOnly] = useState(false)

  const filtered = investors.filter((inv) => {
    if (activeTab !== 'all' && inv.service_type !== activeTab) return false
    if (needsPocOnly && pocCoverage(inv.contacts) === 'covered') return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      inv.name.toLowerCase().includes(q) ||
      (inv.country ?? '').toLowerCase().includes(q) ||
      (inv.country && inv.country !== 'India' && 'foreign'.includes(q)) ||
      (inv.stage ?? '').toLowerCase().includes(q) ||
      inv.sectors.join(' ').toLowerCase().includes(q) ||
      (inv.esv_pocs ?? []).some((p) => p.name.toLowerCase().includes(q)) ||
      (inv.referred_by_partner?.name ?? '').toLowerCase().includes(q)
    )
  })

  // Funds with nobody confirmed reachable — the gap worth working through, sized so it is not
  // a vague worry.
  const needsPoc = investors.filter(
    (i) => i.service_type !== 'angel_investor' && pocCoverage(i.contacts) !== 'covered',
  ).length

  function countFor(tab: Tab) {
    return tab === 'all'
      ? investors.length
      : investors.filter((i) => i.service_type === tab).length
  }

  function openCreate() {
    setEditTarget(null)
    setShowForm(true)
  }

  function openEdit(inv: Investor) {
    setEditTarget(inv)
    setShowForm(true)
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Investors</h1>
          <p className={styles.pageSubtitle}>Fund database and relationship tracking</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isInternal && <button className={styles.ghostBtn} onClick={() => setShowImport(true)}>Import CSV</button>}
          {canManage && <button className={styles.addBtn} onClick={openCreate}>+ Add Investor</button>}
        </div>
      </div>

      {/* Tabs */}
      <FilterTabs
        tabs={ALL_TABS.map((tab) => ({
          value: tab,
          label: tab === 'all' ? 'All' : SERVICE_TYPE_LABELS[tab as ServiceType],
          count: countFor(tab),
        }))}
        value={activeTab}
        onChange={(v) => setActiveTab(v as Tab)}
      />

      {/* The POC gap, sized. Derived from the contacts each time rather than stored, so it can
          never be stale — and it disappears entirely once there is nothing to chase. */}
      {isInternal && needsPoc > 0 && (
        <button
          className={needsPocOnly ? styles.pocFilterOn : styles.pocFilter}
          onClick={() => setNeedsPocOnly(!needsPocOnly)}
          aria-pressed={needsPocOnly}
        >
          {needsPocOnly ? '← All funds' : `${needsPoc} funds need a POC`}
        </button>
      )}

      {/* Search */}
      <div className={styles.searchWrap}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search by name, country, sector, stage, POC…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          {search ? 'No investors match your search.' : 'No investors yet. Add one to get started.'}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((inv) => (
            <InvestorCard key={inv.id} investor={inv} onClick={() => setSelected(inv)} />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <InvestorDetail
          investor={selected}
          userRole={userRole}
          onClose={() => setSelected(null)}
          onEdit={() => { openEdit(selected); setSelected(null) }}
          onDeleted={() => setSelected(null)}
        />
      )}

      {/* Create / Edit modal */}
      {showForm && canManage && (
        <InvestorFormModal
          mode={editTarget ? 'edit' : 'create'}
          initial={editTarget ?? undefined}
          internalUsers={internalUsers}
          franchisePartners={franchisePartners}
          userRole={userRole}
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}

      {/* CSV import */}
      {showImport && isInternal && (
        <InvestorsImportModal
          onClose={() => setShowImport(false)}
          onImported={() => router.refresh()}
        />
      )}
    </div>
  )
}
