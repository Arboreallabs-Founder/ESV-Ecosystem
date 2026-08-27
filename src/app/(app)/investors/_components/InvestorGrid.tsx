'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { pocCoverage, SERVICE_TYPE_LABELS } from '@/lib/types'
import type { PartnerInvestorReferral, Investor, InvestorListItem, ServiceType } from '@/lib/types'
import InvestorCard from './InvestorCard'
import InvestorDetail from './InvestorDetail'
import InvestorFormModal from './InvestorFormModal'
import InvestorsImportModal from './InvestorsImportModal'
import DuplicatesModal from './DuplicatesModal'
import LogoImportButton from './LogoImportButton'
import FilterTabs from '@/app/_components/FilterTabs'
import styles from '../investors.module.css'
import { WikiButton } from '@/app/_components/WikiPanel'
import ReferInvestorPanel from './ReferInvestorPanel'
import InvestorDetailSkeleton from './InvestorDetailSkeleton'
import { getInvestorFull } from '@/app/actions/investors'
import { alertError } from '@/lib/client-errors'

type Props = {
  /** The lean projection. The drawer asks for the full record when it opens. */
  investors: InvestorListItem[]
  userRole: string
  canManage?: boolean
  internalUsers: Array<{ id: string; name: string }>
  franchisePartners: Array<{ id: string; name: string }>
  /** Partners only: what they have referred and where each one got to. */
  referrals?: PartnerInvestorReferral[]
}

/**
 * Tabs are DERIVED from the data, not a fixed list.
 *
 * The hard-coded five hid 23 investors: merchant banks, PE funds, accelerators, debt funds and a
 * corporate VC arm had no tab at all and could only be reached by guessing a search term. A fixed
 * list goes stale the moment a new service type is used, and nothing tells you it has.
 *
 * Types with no investors are left out rather than shown at zero — an empty tab is a dead end.
 */
type Tab = 'all' | ServiceType

export default function InvestorGrid({ investors, userRole, canManage = true, internalUsers, franchisePartners, referrals = [] }: Props) {
  const router = useRouter()
  const isInternal = ['founder', 'admin', 'associate', 'hr'].includes(userRole)
  const isPartner = userRole === 'franchise_partner'
  // Merging is destructive and the RPC refuses anyone else, so this is not offered to an associate
  // as a button that would always error.
  const isLead = ['founder', 'admin', 'super_admin'].includes(userRole)
  // A set, not one value. "Show me the VC funds and the family offices" was two searches before,
  // and an empty set means all -- so the bar still opens showing everything.
  const [types, setTypes] = useState<ServiceType[]>([])
  const [letter, setLetter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // The id is what a click gives us; the record is fetched. Holding both means the drawer can
  // open immediately with a skeleton rather than waiting for a round trip before anything happens.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Investor | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showDupes, setShowDupes] = useState(false)
  const [editTarget, setEditTarget] = useState<Investor | null>(null)
  // Off by default. It is a work queue, not a lens you want on every time you open the page.
  const [needsPocOnly, setNeedsPocOnly] = useState(false)
  const [, startDetail] = useTransition()

  // Biggest groups first: the tab you want is usually the one with the most in it.
  const presentTabs = useMemo(() => {
    const counts = new Map<ServiceType, number>()
    for (const i of investors) counts.set(i.service_type, (counts.get(i.service_type) ?? 0) + 1)
    return ['all' as Tab, ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t as Tab)]
  }, [investors])

  /** The first character a reader would file the name under. Digits and symbols land on #. */
  const initialOf = (name: string) => {
    const c = (name.trim().match(/[a-z0-9]/i)?.[0] ?? '#').toUpperCase()
    return /[A-Z]/.test(c) ? c : '#'
  }

  // Everything except the letter, so the A-Z row can say which letters are actually reachable
  // under the filters already applied rather than offering 26 buttons half of which find nothing.
  const matchesExceptLetter = (inv: Investor | InvestorListItem) => {
    if (types.length > 0 && !types.includes(inv.service_type)) return false
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
  }

  const preLetter = investors.filter(matchesExceptLetter)
  const availableLetters = useMemo(
    () => new Set(preLetter.map((i) => initialOf(i.name))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preLetter],
  )
  const filtered = letter ? preLetter.filter((i) => initialOf(i.name) === letter) : preLetter

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

  const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]

  function openDetail(id: string) {
    setSelectedId(id)
    setSelected(null)
    startDetail(async () => {
      try {
        const full = await getInvestorFull(id)
        // Ignore a response for an investor the user has already clicked away from.
        setSelected((prev) => (full && full.id === id ? full : prev))
      } catch (err) {
        alertError(err)
        setSelectedId(null)
      }
    })
  }

  function closeDetail() {
    setSelectedId(null)
    setSelected(null)
  }

  function openCreate() {
    setEditTarget(null)
    setShowForm(true)
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 className={styles.pageTitle}>Investors</h1>
            <WikiButton sectionKey="investors" />
          </div>
          <p className={styles.pageSubtitle}>
            {isPartner
              ? 'The funds credited to you, and anyone you have referred to us.'
              : 'Fund database and relationship tracking'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isLead && <LogoImportButton />}
          {isLead && <button className={styles.ghostBtn} onClick={() => setShowDupes(true)}>Find duplicates</button>}
          {isInternal && <button className={styles.ghostBtn} onClick={() => setShowImport(true)}>Import CSV</button>}
          {canManage && <button className={styles.addBtn} onClick={openCreate}>+ Add Investor</button>}
        </div>
      </div>

      {isPartner && <ReferInvestorPanel referrals={referrals} />}

      {/* Tabs */}
      <FilterTabs
        tabs={presentTabs.map((tab) => ({
          value: tab,
          label: tab === 'all' ? 'All' : SERVICE_TYPE_LABELS[tab as ServiceType],
          count: countFor(tab),
        }))}
        values={types.length === 0 ? ['all'] : types}
        onChange={(v) => {
          // "All" is the absence of a filter, not a value alongside the others -- picking it has
          // to clear the set rather than join it, or "All + VC Fund" becomes a state that reads as
          // contradictory and filters as neither.
          if (v === 'all') { setTypes([]); return }
          const t = v as ServiceType
          setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
        }}
      />

      {/* A-Z. Letters with nothing behind them are disabled rather than hidden, so the row keeps
          the same shape as you filter and a letter stays where your eye last found it. */}
      <div className={styles.azRow} role="group" aria-label="Filter by first letter">
        <button
          className={letter === null ? styles.azOn : styles.az}
          onClick={() => setLetter(null)}
          aria-pressed={letter === null}
        >
          All
        </button>
        {LETTERS.map((c) => {
          const has = availableLetters.has(c)
          return (
            <button
              key={c}
              className={letter === c ? styles.azOn : styles.az}
              disabled={!has}
              aria-pressed={letter === c}
              onClick={() => setLetter(letter === c ? null : c)}
              title={c === '#' ? 'Names starting with a number or symbol' : undefined}
            >
              {c}
            </button>
          )
        })}
      </div>

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
            <InvestorCard key={inv.id} investor={inv} onClick={() => openDetail(inv.id)} />
          ))}
        </div>
      )}

      {/* Detail drawer. Opens on the click and fills in when the record lands. */}
      {selectedId && (
        selected
          ? (
            <InvestorDetail
              investor={selected}
              userRole={userRole}
              onClose={closeDetail}
              onDeleted={closeDetail}
            />
          )
          : <InvestorDetailSkeleton onClose={closeDetail} />
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
      {showDupes && isLead && <DuplicatesModal onClose={() => setShowDupes(false)} />}

      {showImport && isInternal && (
        <InvestorsImportModal
          onClose={() => setShowImport(false)}
          onImported={() => router.refresh()}
        />
      )}
    </div>
  )
}
