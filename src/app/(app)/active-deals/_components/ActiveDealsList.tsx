'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ActiveDeal, DealCategory } from '@/lib/types'
import ActiveDealDetail from './ActiveDealDetail'
import NewDealModal from './NewDealModal'
import DealImportModal from './DealImportModal'
import FilterTabs from '@/app/_components/FilterTabs'
import styles from '../active-deals.module.css'

// Group a plain number with Indian digit separators (e.g. 100000000 → 10,00,00,000).
// Leaves non-numeric text (e.g. "100 Cr", "8cr") untouched.
function delimitNumber(value: string): string {
  const raw = value.replace(/,/g, '').trim()
  if (raw === '' || !/^-?\d+(\.\d+)?$/.test(raw)) return value
  const n = Number(raw)
  if (!Number.isFinite(n)) return value
  return n.toLocaleString('en-IN')
}

function formatValue(value: string, fieldType: string) {
  if (fieldType === 'url') {
    try {
      const url = new URL(value)
      return <a href={url.href} target="_blank" rel="noopener noreferrer" className={styles.fieldLink}>{url.hostname.replace('www.', '')}</a>
    } catch { return value }
  }
  if (fieldType === 'percentage') return `${delimitNumber(value)}%`
  if (fieldType === 'numeric') return delimitNumber(value)
  return value
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ActiveDealsList({ deals, categories, userRole }: { deals: ActiveDeal[]; categories: DealCategory[]; userRole: string }) {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [selectedDeal, setSelectedDeal] = useState<ActiveDeal | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const canManage = userRole === 'founder' || userRole === 'admin'

  const uncategorised = deals.filter((d) => d.categories.length === 0)
  const categorised = categories.filter((cat) => deals.some((d) => d.categories.some((c) => c.category.id === cat.id)))

  const filtered = activeFilter === 'all'
    ? deals
    : activeFilter === 'uncategorised'
    ? uncategorised
    : deals.filter((d) => d.categories.some((c) => c.category.id === activeFilter))

  return (
    <div className={styles.page}>
      {selectedDeal && (
        <ActiveDealDetail deal={selectedDeal} onClose={() => setSelectedDeal(null)} userRole={userRole} />
      )}
      {showNew && <NewDealModal categories={categories} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); router.refresh() }} />}
      {showImport && <DealImportModal categories={categories} onClose={() => setShowImport(false)} onImported={() => router.refresh()} />}
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Active Deals</div>
          <div className={styles.pageSub}>{deals.length} deal{deals.length !== 1 ? 's' : ''} accepted</div>
        </div>
        {canManage && (
          <div className={styles.headerActions}>
            <button className={styles.ghostBtn} onClick={() => setShowImport(true)}>Import CSV</button>
            <button className={styles.primaryBtn} onClick={() => setShowNew(true)}>+ New deal</button>
          </div>
        )}
      </div>

      {/* Category filter tabs */}
      {(categorised.length > 0 || uncategorised.length > 0) && (
        <FilterTabs
          tabs={[
            { value: 'all', label: 'All', count: deals.length },
            ...categorised.map((cat) => ({
              value: cat.id,
              label: cat.name,
              dot: cat.color,
              count: deals.filter((d) => d.categories.some((c) => c.category.id === cat.id)).length,
            })),
            ...(uncategorised.length > 0
              ? [{ value: 'uncategorised', label: 'Uncategorised', count: uncategorised.length }]
              : []),
          ]}
          value={activeFilter}
          onChange={setActiveFilter}
        />
      )}

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {deals.length === 0
            ? 'No active deals yet. Move a pipeline entry to the Accepted stage to add one.'
            : 'No deals match this filter.'}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((deal) => (
            <div key={deal.id} className={styles.card} onClick={() => setSelectedDeal(deal)} style={{ cursor: 'pointer' }}>
              <div className={styles.cardTop}>
                <div className={styles.dealTitle}>{deal.entry?.title ?? 'Untitled'}</div>
                <div className={styles.dealMeta}>
                  {deal.entry?.submitter_name && <span>{deal.entry.submitter_name}</span>}
                  {deal.entry?.submitter_email && <span className={styles.dealEmail}>{deal.entry.submitter_email}</span>}
                  <span className={styles.dealDate}>Accepted {formatDate(deal.created_at)}</span>
                </div>
                {deal.entry?.sourced_via_partner && (
                  <span className={styles.partnerChip}>via {deal.entry.sourced_via_partner.name}</span>
                )}
              </div>

              {/* Category chips */}
              {deal.categories.length > 0 && (
                <div className={styles.categoryChips}>
                  {deal.categories.map(({ category }) => (
                    <span key={category.id} className={styles.catChip} style={{ background: `${category.color}18`, color: category.color, borderColor: `${category.color}40` }}>
                      {category.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Field values per category */}
              {deal.categories.map(({ category, field_values }) => {
                const populated = field_values.filter((fv) => fv.value)
                if (populated.length === 0) return null
                return (
                  <div key={category.id} className={styles.fieldGroup}>
                    <div className={styles.fieldGroupLabel} style={{ color: category.color }}>{category.name}</div>
                    {populated.map((fv) => {
                      const field = category.fields.find((f) => f.id === fv.field_id)
                      if (!field) return null
                      return (
                        <div key={fv.field_id} className={styles.fieldValueRow}>
                          <span className={styles.fieldKey}>{field.label}</span>
                          <span className={`${styles.fieldVal} ${field.field_type === 'numeric' || field.field_type === 'percentage' ? styles.fieldValNum : ''}`}>{formatValue(fv.value!, field.field_type)}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
