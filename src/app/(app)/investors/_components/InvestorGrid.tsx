'use client'

import { useState } from 'react'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import type { Investor, ServiceType } from '@/lib/types'
import InvestorCard from './InvestorCard'
import InvestorDetail from './InvestorDetail'
import InvestorFormModal from './InvestorFormModal'
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
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Investor | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Investor | null>(null)

  const filtered = investors.filter((inv) => {
    if (activeTab !== 'all' && inv.service_type !== activeTab) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      inv.name.toLowerCase().includes(q) ||
      (inv.country ?? '').toLowerCase().includes(q) ||
      (inv.stage ?? '').toLowerCase().includes(q) ||
      inv.sectors.join(' ').toLowerCase().includes(q) ||
      (inv.esv_pocs ?? []).some((p) => p.name.toLowerCase().includes(q)) ||
      (inv.referred_by_partner?.name ?? '').toLowerCase().includes(q)
    )
  })

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
        {canManage && <button className={styles.addBtn} onClick={openCreate}>+ Add Investor</button>}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {ALL_TABS.map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'all' ? 'All' : SERVICE_TYPE_LABELS[tab as ServiceType]}
            <span className={styles.tabCount}>{countFor(tab)}</span>
          </button>
        ))}
      </div>

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
    </div>
  )
}
