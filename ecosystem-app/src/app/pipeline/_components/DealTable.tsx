'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Deal, DealStage } from '@/lib/types'
import { DEAL_STAGES } from '@/lib/types'
import styles from './deal-table.module.css'

type SortKey = 'company_name' | 'sector' | 'current_stage' | 'source' | 'created_at'
type SortDir = 'asc' | 'desc'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STAGE_INDEX: Record<DealStage, number> = Object.fromEntries(
  DEAL_STAGES.map((s, i) => [s, i])
) as Record<DealStage, number>

export default function DealTable({ deals }: { deals: Deal[] }) {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<DealStage | ''>('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let rows = deals
    if (search.trim()) rows = rows.filter((d) => d.company_name.toLowerCase().includes(search.toLowerCase()))
    if (stageFilter) rows = rows.filter((d) => d.current_stage === stageFilter)
    rows = [...rows].sort((a, b) => {
      let va: string | number = a[sortKey] ?? ''
      let vb: string | number = b[sortKey] ?? ''
      if (sortKey === 'current_stage') { va = STAGE_INDEX[a.current_stage]; vb = STAGE_INDEX[b.current_stage] }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return rows
  }, [deals, search, stageFilter, sortKey, sortDir])

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className={styles.sortIcon}>↕</span>
    return <span className={styles.sortIconActive}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className={styles.wrap}>
      {/* Filter bar */}
      <div className={styles.filterBar}>
        <input
          className={styles.search}
          placeholder="Search company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.stageSelect}
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as DealStage | '')}
        >
          <option value="">All stages</option>
          {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className={styles.count}>{filtered.length} deal{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {([
                ['company_name', 'Company'],
                ['sector', 'Sector'],
                ['current_stage', 'Stage'],
                ['source', 'Source'],
                ['created_at', 'Added'],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th key={key} onClick={() => toggleSort(key)} className={styles.th}>
                  {label} <SortIcon k={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className={styles.empty}>No deals match your filters.</td></tr>
            ) : (
              filtered.map((deal) => (
                <tr key={deal.id} className={styles.row}>
                  <td className={styles.td}>
                    <Link href={`/pipeline/${deal.id}`} className={styles.companyLink}>{deal.company_name}</Link>
                    {deal.founder_name && <div className={styles.sub}>{deal.founder_name}</div>}
                  </td>
                  <td className={styles.td}>{deal.sector}</td>
                  <td className={styles.td}><span className={styles.stagePill}>{deal.current_stage}</span></td>
                  <td className={styles.td}>{deal.source}</td>
                  <td className={styles.td}>{formatDate(deal.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
