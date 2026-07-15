'use client'

import { useState, useTransition, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ActiveDeal, DealCategory, DealState } from '@/lib/types'
import { DEAL_STATES, DEAL_STATE_META } from '@/lib/types'
import { updateDealState } from '@/app/actions/active-deals'
import NewDealModal from './NewDealModal'
import DealImportModal from './DealImportModal'
import FilterTabs from '@/app/_components/FilterTabs'
import { WikiButton } from '@/app/_components/WikiPanel'
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
      return <a href={url.href} target="_blank" rel="noopener noreferrer" className={styles.fieldLink} onClick={(e) => e.stopPropagation()}>{url.hostname.replace('www.', '')}</a>
    } catch { return value }
  }
  if (fieldType === 'percentage') return `${delimitNumber(value)}%`
  if (fieldType === 'numeric') return delimitNumber(value)
  return value
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// State filter: 'open' = everything except archived (the default working set).
type StateFilter = 'open' | DealState

export default function ActiveDealsList({ deals: initialDeals, categories, userRole }: { deals: ActiveDeal[]; categories: DealCategory[]; userRole: string }) {
  const router = useRouter()
  const [stateFilter, setStateFilter] = useState<StateFilter>('open')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  // Optimistic state overrides layered over server data — avoids re-seeding a whole
  // deals array (and a setState-in-effect) when the server refreshes after a new deal.
  const [stateOverrides, setStateOverrides] = useState<Record<string, DealState>>({})
  const [, startTransition] = useTransition()
  const canManage = userRole === 'founder' || userRole === 'admin'
  const canEditState = userRole !== 'franchise_partner'

  const deals = initialDeals.map((d) => stateOverrides[d.id] ? { ...d, deal_state: stateOverrides[d.id] } : d)

  const usedCategories = categories.filter((cat) => deals.some((d) => d.categories.some((c) => c.category.id === cat.id)))

  const stateCount = (s: StateFilter) =>
    s === 'open' ? deals.filter((d) => d.deal_state !== 'archived').length
                 : deals.filter((d) => d.deal_state === s).length

  const filtered = deals.filter((d) => {
    if (stateFilter === 'open') { if (d.deal_state === 'archived') return false }
    else if (d.deal_state !== stateFilter) return false
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'uncategorised') { if (d.categories.length > 0) return false }
      else if (!d.categories.some((c) => c.category.id === categoryFilter)) return false
    }
    return true
  })

  function handleStateChange(deal: ActiveDeal, next: DealState) {
    const prevState = deal.deal_state
    setStateOverrides((prev) => ({ ...prev, [deal.id]: next }))
    startTransition(async () => {
      try { await updateDealState(deal.id, next) }
      catch (err) {
        setStateOverrides((prev) => ({ ...prev, [deal.id]: prevState }))
        alert(String(err))
        router.refresh()
      }
    })
  }

  function openDeal(id: string) {
    router.push(`/active-deals/${id}`)
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDeal(id)
    }
  }

  return (
    <div className={styles.page}>
      {showNew && <NewDealModal categories={categories} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); router.refresh() }} />}
      {showImport && <DealImportModal categories={categories} onClose={() => setShowImport(false)} onImported={() => router.refresh()} />}
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>Active Deals</div>
            <WikiButton sectionKey="activeDeals" />
          </div>
          <div className={styles.pageSub}>{stateCount('open')} live · {deals.length} total</div>
        </div>
        {canManage && (
          <div className={styles.headerActions}>
            <button className={styles.ghostBtn} onClick={() => setShowImport(true)}>Import CSV</button>
            <button className={styles.primaryBtn} onClick={() => setShowNew(true)}>+ New deal</button>
          </div>
        )}
      </div>

      {/* State filter (archived hidden unless selected) */}
      <FilterTabs
        tabs={[
          { value: 'open', label: 'All', count: stateCount('open') },
          ...DEAL_STATES.map((s) => ({ value: s, label: DEAL_STATE_META[s].label, dot: DEAL_STATE_META[s].color, count: stateCount(s) })),
        ]}
        value={stateFilter}
        onChange={(v) => setStateFilter(v as StateFilter)}
      />

      {/* Category filter (compact) */}
      {usedCategories.length > 0 && (
        <div className={styles.subControls}>
          <label className={styles.subControlLabel}>Category</label>
          <select className={styles.categorySelect} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {usedCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            {deals.some((d) => d.categories.length === 0) && <option value="uncategorised">Uncategorised</option>}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {deals.length === 0
            ? 'No active deals yet. Move a pipeline entry to the Accepted stage to add one.'
            : 'No deals match this filter.'}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((deal) => {
            const meta = DEAL_STATE_META[deal.deal_state]
            return (
              <article
                key={deal.id}
                className={styles.card}
                role="button"
                tabIndex={0}
                onClick={() => openDeal(deal.id)}
                onKeyDown={(event) => handleCardKeyDown(event, deal.id)}
                aria-label={`Open ${deal.entry?.title ?? 'deal'}`}
              >
                <div className={styles.cardHead}>
                  <div className={styles.cardTitleBlock}>
                    <div className={styles.dealTitle}>{deal.entry?.title ?? 'Untitled'}</div>
                    <div className={styles.openHint}>Open record</div>
                  </div>
                  {canEditState ? (
                    <select
                      className={styles.stateSelect}
                      value={deal.deal_state}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); handleStateChange(deal, e.target.value as DealState) }}
                      style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}12` }}
                      title="Change deal state"
                    >
                      {DEAL_STATES.map((s) => <option key={s} value={s} style={{ color: 'var(--color-text)' }}>{DEAL_STATE_META[s].label}</option>)}
                    </select>
                  ) : (
                    <span className={styles.stateBadge} style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}12` }}>
                      {meta.label}
                    </span>
                  )}
                </div>

                <div className={styles.dealMeta}>
                  {deal.entry?.submitter_name && <span className={styles.metaPill}>{deal.entry.submitter_name}</span>}
                  <span className={styles.metaPill}>Accepted {formatDate(deal.created_at)}</span>
                  {deal.entry?.sourced_via_partner && (
                    <span className={styles.partnerChip}>via {deal.entry.sourced_via_partner.name}</span>
                  )}
                </div>

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
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
