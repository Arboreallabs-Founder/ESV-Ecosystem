'use client'

import { useState, useTransition, type KeyboardEvent } from 'react'
import { alertError } from '@/lib/client-errors'
import { useRouter } from 'next/navigation'
import type { ActiveDeal, DealCategory, DealState } from '@/lib/types'
import { DEAL_STATES, DEAL_STATE_META } from '@/lib/types'
import { updateDealState, deleteActiveDeal } from '@/app/actions/active-deals'
import NewDealModal from './NewDealModal'
import DealImportModal from './DealImportModal'
import FilterTabs from '@/app/_components/FilterTabs'
import { WikiButton } from '@/app/_components/WikiPanel'
import { AvatarGroup } from '@/app/_components/Avatar'
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

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
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

export default function ActiveDealsList({
  deals: initialDeals,
  categories,
  companyOptions,
  userRole,
}: {
  deals: ActiveDeal[]
  categories: DealCategory[]
  companyOptions: Array<{ id: string; name: string }>
  userRole: string
}) {
  const router = useRouter()
  const [stateFilter, setStateFilter] = useState<StateFilter>('open')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const isPartner = userRole === 'franchise_partner'
  // Collapsed by default. A card's job in a list is to be recognised and compared; the field
  // values are for after you have chosen one, and showing every deal's fee structure at once
  // makes the list longer than the screen for no gain.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  // Optimistic state overrides layered over server data — avoids re-seeding a whole
  // deals array (and a setState-in-effect) when the server refreshes after a new deal.
  const [stateOverrides, setStateOverrides] = useState<Record<string, DealState>>({})
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()
  const canManage = userRole === 'founder' || userRole === 'admin'
  const canEditState = !['franchise_partner', 'general'].includes(userRole)

  const deals = initialDeals
    .filter((d) => !deletedIds.has(d.id))
    .map((d) => stateOverrides[d.id] ? { ...d, deal_state: stateOverrides[d.id] } : d)

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
        alertError(err)
        router.refresh()
      }
    })
  }

  function handleDelete(deal: ActiveDeal) {
    if (!confirm(`Delete "${deal.entry?.title ?? 'this deal'}"? This removes the deal and its original pipeline entry entirely — this cannot be undone.`)) return
    setDeletedIds((prev) => new Set(prev).add(deal.id))
    startTransition(async () => {
      try { await deleteActiveDeal(deal.id) }
      catch (err) {
        setDeletedIds((prev) => { const n = new Set(prev); n.delete(deal.id); return n })
        alertError(err)
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
      {showNew && <NewDealModal categories={categories} companyOptions={companyOptions} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); router.refresh() }} />}
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
            // A logo set directly on the deal wins; otherwise fall back to the linked company's logo.
            const displayLogoUrl = deal.logo_url || deal.entry?.company?.logo_url || null
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
                  <div className={styles.cardTitleRow}>
                    <div className={`${styles.cardLogo} ${displayLogoUrl ? styles.logoImg : ''}`}>
                      {displayLogoUrl ? <img src={displayLogoUrl} alt="" /> : initials(deal.entry?.title ?? '?')}
                    </div>
                    <div className={styles.cardTitleBlock}>
                      <div className={styles.dealTitle}>{deal.entry?.title ?? 'Untitled'}</div>
                      <div className={styles.openHint}>Open record</div>
                    </div>
                  </div>
                  <div className={styles.cardHeadRight}>
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
                    {canManage && (
                      <button
                        className={styles.cardDeleteBtn}
                        onClick={(e) => { e.stopPropagation(); handleDelete(deal) }}
                        title="Delete deal"
                        aria-label="Delete deal"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.dealMeta}>
                  {deal.entry?.submitter_name && <span className={styles.metaPill}>{deal.entry.submitter_name}</span>}
                  <span className={styles.metaPill}>Accepted {formatDate(deal.created_at)}</span>
                  {/* Only leads see this, and only when it is off — a chip on every visible deal
                      would be noise, since visible is the norm. */}
                  {canManage && deal.visible_to_partners === false && (
                    <span className={styles.hiddenChip} title="Partners cannot see this deal in their portal">
                      Hidden from partners
                    </span>
                  )}
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

                {/* Who's running this mandate. Faces rather than names: at card scale a name list
                    wraps and competes with the deal title, whereas a stack of faces is scannable
                    at a glance and is the thing people actually look for. */}
                {/* The team row doubles as the expander. Field values are the long part of a card
                    and mostly matter once you have picked a deal, so a wall of them makes the list
                    harder to scan than the cards it is made of. */}
                {(() => {
                  const hasFields = deal.categories.some(({ field_values }) => field_values.some((fv) => fv.value))
                  const isOpen = expanded.has(deal.id)
                  if ((deal.entry?.assignees?.length ?? 0) === 0 && !hasFields) return null
                  return (
                    <button
                      type="button"
                      className={styles.dealTeam}
                      onClick={(e) => { e.stopPropagation(); toggleExpanded(deal.id) }}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? 'Hide deal details' : 'Show deal details'}
                      disabled={!hasFields}
                    >
                      <AvatarGroup
                        people={(deal.entry?.assignees ?? []).map((a) => ({ id: a.user_id, name: a.name, photo_url: a.photo_url }))}
                        size="sm"
                      />
                      <span className={styles.dealTeamLabel}>
                        {(deal.entry?.assignees ?? []).map((a) => a.name).join(', ') || 'Unassigned'}
                      </span>
                      {hasFields && (
                        <span className={isOpen ? styles.chevronOpen : styles.chevron} aria-hidden="true">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </span>
                      )}
                    </button>
                  )
                })()}

                {/* Field values per category */}
                {expanded.has(deal.id) && deal.categories.map(({ category, field_values }) => {
                  // Partners see only the fields marked visible_to_partners. Filtering here rather
                  // than in the query keeps one source of truth for "what is on this deal" and one
                  // rule for who may read each part of it.
                  const populated = field_values.filter((fv) => {
                    if (!fv.value) return false
                    if (!isPartner) return true
                    return category.fields.find((f) => f.id === fv.field_id)?.visible_to_partners === true
                  })
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
