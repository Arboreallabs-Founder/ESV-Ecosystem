'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { DeskOverview, DeskOverviewRow } from '@/lib/deal-desk'
import { DESK_DEAL_STATUS_LABELS } from '@/lib/types'
import Avatar from '@/app/_components/Avatar'
import { formatInrShort, formatDate, daysSince } from './format'
import TrendChart from '@/app/_components/charts/TrendChart'
import Donut from '@/app/_components/charts/Donut'
import styles from './deal-desk.module.css'

const PAGE_SIZE = 10

// Deliberately not a mock-up-shaped "vs last month" on every tile. Only new deals have a truthful
// month-on-month comparison: a deal created in June can be rejected in August, so counting
// "rejected last month" by creation date would quietly report something no one asked about.
function MonthDelta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0 && now === 0) return null
  if (prev === 0) return <span className={styles.kpiDeltaUp}>↗ first this month</span>
  const pct = Math.round(((now - prev) / prev) * 100)
  if (pct === 0) return <span className={styles.kpiDeltaFlat}>→ level with last month</span>
  return (
    <span className={pct > 0 ? styles.kpiDeltaUp : styles.kpiDeltaDown}>
      {pct > 0 ? '↗' : '↘'} {Math.abs(pct)}% vs last month
    </span>
  )
}

export default function DeskOverviewPanel({ overview }: { overview: DeskOverview }) {
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState<string | null>(null)
  const [sector, setSector] = useState('')
  const [owner, setOwner] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)

  const sectors = useMemo(
    () => [...new Set(overview.rows.map((r) => r.sector).filter(Boolean))].sort() as string[],
    [overview.rows],
  )
  const owners = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of overview.rows) seen.set(r.associate_id, r.associate_name)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [overview.rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return overview.rows.filter((r) => {
      if (q && !`${r.company_name} ${r.sector ?? ''} ${r.associate_name}`.toLowerCase().includes(q)) return false
      if (stage && (stage === 'Not set' ? r.stage != null : r.stage !== stage)) return false
      if (sector && r.sector !== sector) return false
      if (owner && r.associate_id !== owner) return false
      if (status && r.deal_status !== status) return false
      return true
    })
  }, [overview.rows, search, stage, sector, owner, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const filtersOn = Boolean(search || stage || sector || owner || status)

  function reset() {
    setSearch(''); setStage(null); setSector(''); setOwner(''); setStatus(''); setPage(0)
  }

  const kpis = [
    { label: 'Total deals', value: overview.total, foot: <MonthDelta now={overview.addedThisMonth} prev={overview.addedLastMonth} /> },
    { label: 'Awaiting review', value: overview.unseen, foot: <span className={styles.kpiFoot}>Nobody has opened these</span> },
    { label: 'Open', value: overview.open, foot: <span className={styles.kpiFoot}>No decision recorded</span> },
    { label: 'To discuss', value: overview.discuss, foot: <span className={styles.kpiFoot}>Flagged for a conversation</span> },
    { label: 'Total ask', value: formatInrShort(overview.totalAskInr), foot: <span className={styles.kpiFoot}>Across every card on the desk</span> },
  ]

  return (
    <div className={styles.overview}>
      {/* ── KPI strip + trend ── */}
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Deal overview</h2>
          <span className={styles.panelNote}>Last 30 days</span>
        </div>

        <div className={styles.kpiStrip}>
          {kpis.map((k) => (
            <div key={k.label} className={styles.kpi}>
              <div className={styles.kpiLabel}>{k.label}</div>
              <div className={styles.kpiValue}>{k.value}</div>
              {k.foot}
            </div>
          ))}
        </div>

        <TrendChart points={overview.trend} />
      </section>

      <div className={styles.overviewSide}>
        {/* ── Stage mix ── */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Deals by stage</h2>
            {stage && <button className={styles.panelLink} onClick={() => { setStage(null); setPage(0) }}>Clear</button>}
          </div>
          <Donut
            data={overview.byStage}
            selected={stage}
            onSelect={(s) => { setStage(s); setPage(0) }}
            centreLabel="On the desk"
            ariaLabel="Deals by funding stage"
          />
          <p className={styles.panelFoot}>
            Funding stage of the company, not review progress — pick one to filter the table.
          </p>
        </section>

        {/* ── The actual to-do.
             The mock-up has "Upcoming Milestones" here; Deal Desk has no milestone data and
             inventing one would put a fabricated date in front of someone. What genuinely waits on
             a reviewer is the unopened cards, so that is what this slot shows. ── */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Waiting on you</h2>
            <span className={styles.panelNote}>{overview.unseen} unopened</span>
          </div>
          {overview.waiting.length === 0 ? (
            <div className={styles.chartEmpty}>Everything on the desk has been looked at.</div>
          ) : (
            <ul className={styles.waitList}>
              {overview.waiting.map((r) => {
                const age = daysSince(r.created_at)
                return (
                  <li key={r.id}>
                    <Link href={`/deal-desk/${r.associate_id}`} className={styles.waitRow}>
                      <Avatar name={r.associate_name} photoUrl={r.associate_photo} size="sm" />
                      <span className={styles.waitBody}>
                        <span className={styles.waitName}>{r.company_name}</span>
                        <span className={styles.waitMeta}>{r.associate_name}{r.sector ? ` · ${r.sector}` : ''}</span>
                      </span>
                      <span className={age !== null && age >= 7 ? styles.waitAgeOld : styles.waitAge}>
                        {age === null ? '' : age === 0 ? 'today' : `${age}d`}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ── All deals ── */}
      <section className={styles.panel}>
        <div className={styles.tableHead}>
          <h2 className={styles.panelTitle}>All deals</h2>
          <div className={styles.tableControls}>
            <input
              className={styles.tableSearch}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search deals…"
              aria-label="Search deals"
            />
            <select className={styles.tableSelect} value={stage ?? ''} onChange={(e) => { setStage(e.target.value || null); setPage(0) }} aria-label="Filter by stage">
              <option value="">All stages</option>
              {overview.byStage.filter((s) => s.count > 0).map((s) => (
                <option key={s.label} value={s.label}>{s.label}</option>
              ))}
            </select>
            <select className={styles.tableSelect} value={sector} onChange={(e) => { setSector(e.target.value); setPage(0) }} aria-label="Filter by sector">
              <option value="">All sectors</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={styles.tableSelect} value={owner} onChange={(e) => { setOwner(e.target.value); setPage(0) }} aria-label="Filter by owner">
              <option value="">All owners</option>
              {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select className={styles.tableSelect} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} aria-label="Filter by status">
              <option value="">All statuses</option>
              {Object.entries(DESK_DEAL_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {filtersOn && <button className={styles.tableReset} onClick={reset}>Reset</button>}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.chartEmpty}>
            {overview.total === 0 ? 'No deal cards have been submitted yet.' : 'No deals match those filters.'}
          </div>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.overviewTable}>
                <thead>
                  <tr>
                    <th>Company</th><th>Sector</th><th>Stage</th><th>Owner</th>
                    <th className={styles.numCol}>Ask</th><th>Status</th><th>Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/deal-desk/${r.associate_id}`} className={styles.tableCompany}>
                          {r.company_name}
                        </Link>
                        {!r.seen_status && <span className={styles.newDot} title="Not yet reviewed" />}
                      </td>
                      <td className={styles.muted}>{r.sector ?? '—'}</td>
                      <td>{r.stage ? <span className={styles.stagePill}>{r.stage}</span> : <span className={styles.muted}>—</span>}</td>
                      <td>
                        <span className={styles.ownerCell}>
                          <Avatar name={r.associate_name} photoUrl={r.associate_photo} size="xs" />
                          {r.associate_name}
                        </span>
                      </td>
                      <td className={styles.numCol}>{r.ask_inr ? formatInrShort(r.ask_inr) : <span className={styles.muted}>—</span>}</td>
                      <td><StatusPill status={r.deal_status} /></td>
                      <td className={styles.muted}>{formatDate(r.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.tableFoot}>
              <span className={styles.tableCount}>
                Showing {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} of {filtered.length}
                {filtersOn && overview.total !== filtered.length ? ` (filtered from ${overview.total})` : ''}
              </span>
              {pageCount > 1 && (
                <div className={styles.pager}>
                  <button className={styles.pagerBtn} onClick={() => setPage(safePage - 1)} disabled={safePage === 0} aria-label="Previous page">‹</button>
                  <span className={styles.pagerNow}>{safePage + 1} / {pageCount}</span>
                  <button className={styles.pagerBtn} onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount - 1} aria-label="Next page">›</button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function StatusPill({ status }: { status: DeskOverviewRow['deal_status'] }) {
  // The label says which status it is, so nothing here is carried by colour alone.
  const cls =
    status === 'rejected' ? styles.pillRejected
    : status === 'discuss' ? styles.pillDiscuss
    : status === 'more_info' ? styles.pillMoreInfo
    : styles.pillOpen
  return <span className={`${styles.statusPill} ${cls}`}>{DESK_DEAL_STATUS_LABELS[status]}</span>
}
