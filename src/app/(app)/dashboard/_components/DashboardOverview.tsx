'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { DashboardOverview } from '@/lib/dashboard'
import Avatar from '@/app/_components/Avatar'
import TrendChart from '@/app/_components/charts/TrendChart'
import Donut from '@/app/_components/charts/Donut'
import styles from '../dashboard.module.css'

const PAGE_SIZE = 8

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

function daysUntil(dateStr: string): number {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateStr}T00:00:00`)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function whenLabel(dateStr: string): string {
  const d = daysUntil(dateStr)
  if (d <= 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return `In ${d} days`
}

const fmtDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

export default function DashboardOverviewPanels({
  overview,
  kpis,
}: {
  overview: DashboardOverview
  kpis: Array<{ label: string; value: number; desc: string; href: string; showDelta?: boolean }>
}) {
  const [stage, setStage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [page, setPage] = useState(0)

  const states = useMemo(
    () => [...new Set(overview.deals.map((d) => d.state))].sort(),
    [overview.deals],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return overview.deals.filter((d) => {
      if (q && !`${d.name} ${d.pipelineName ?? ''} ${d.owners.map((o) => o.name).join(' ')}`.toLowerCase().includes(q)) return false
      if (stage && d.stage !== stage) return false
      if (state && d.state !== state) return false
      return true
    })
  }, [overview.deals, search, stage, state])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const filtersOn = Boolean(search || stage || state)

  return (
    <div className={styles.overview}>
      {/* ── KPI strip + submissions trend ── */}
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Ecosystem overview</h2>
          <span className={styles.panelNote}>Submissions, last 30 days</span>
        </div>

        <div className={styles.kpiStrip}>
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className={styles.kpi}>
              <div className={styles.kpiLabel}>{k.label}</div>
              <div className={styles.kpiValue}>{k.value}</div>
              {k.showDelta
                ? <MonthDelta now={overview.submissionsThisMonth} prev={overview.submissionsLastMonth} />
                : <span className={styles.kpiFoot}>{k.desc}</span>}
            </Link>
          ))}
        </div>

        <TrendChart points={overview.trend} />
      </section>

      <div className={styles.overviewSide}>
        {/* ── Pipeline mix ── */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Submissions by stage</h2>
            {stage && <button className={styles.panelLink} onClick={() => { setStage(null); setPage(0) }}>Clear</button>}
          </div>
          <Donut
            data={overview.byStage}
            selected={stage}
            onSelect={(s) => { setStage(s); setPage(0) }}
            centreLabel="Submissions"
            ariaLabel="Pipeline submissions by stage"
          />
          <p className={styles.panelFoot}>
            Every submission across all pipelines, grouped by the stage it sits in.
          </p>
        </section>

        {/* ── Coming up: real dates, from tasks and events ── */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Coming up</h2>
            <Link href="/tasks" className={styles.panelLink}>Task board</Link>
          </div>
          {overview.upcoming.length === 0 ? (
            <div className={styles.chartEmpty}>Nothing scheduled in the near future.</div>
          ) : (
            <ul className={styles.upList}>
              {overview.upcoming.map((u) => (
                <li key={u.id}>
                  <Link href={u.kind === 'task' ? '/tasks' : '/events'} className={styles.upRow}>
                    <span className={u.kind === 'event' ? styles.upIconEvent : styles.upIconTask} aria-hidden="true">
                      {u.kind === 'event' ? '◆' : '●'}
                    </span>
                    <span className={styles.upBody}>
                      <span className={styles.upTitle}>{u.title}</span>
                      <span className={styles.upMeta}>
                        {/* The kind is spelled out, not left to the icon's shape or colour. */}
                        {u.kind === 'event' ? 'Event' : 'Task'}
                        {u.context ? ` · ${u.context}` : ''} · {fmtDate(u.date)}
                      </span>
                    </span>
                    <span className={daysUntil(u.date) <= 1 ? styles.upWhenSoon : styles.upWhen}>
                      {whenLabel(u.date)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Active deals ── */}
      <section className={styles.panel}>
        <div className={styles.tableHead}>
          <h2 className={styles.panelTitle}>Active deals</h2>
          <div className={styles.tableControls}>
            <input
              className={styles.tableSearch}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search deals…"
              aria-label="Search deals"
            />
            <select className={styles.tableSelect} value={state} onChange={(e) => { setState(e.target.value); setPage(0) }} aria-label="Filter by state">
              <option value="">All states</option>
              {states.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            {filtersOn && (
              <button className={styles.tableReset} onClick={() => { setSearch(''); setStage(null); setState(''); setPage(0) }}>
                Reset
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.chartEmpty}>
            {overview.deals.length === 0 ? 'No active deals yet.' : 'No deals match those filters.'}
          </div>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.overviewTable}>
                <thead>
                  <tr>
                    <th>Company</th><th>Pipeline</th><th>Stage</th><th>Team</th><th>State</th><th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <Link href={`/active-deals/${d.id}`} className={styles.tableCompany}>{d.name}</Link>
                      </td>
                      <td className={styles.muted}>{d.pipelineName ?? '—'}</td>
                      <td>{d.stage ? <span className={styles.stagePill}>{d.stage}</span> : <span className={styles.muted}>—</span>}</td>
                      <td>
                        {d.owners.length === 0 ? <span className={styles.muted}>Unassigned</span> : (
                          <span className={styles.ownerCell}>
                            {d.owners.slice(0, 3).map((o) => (
                              <Avatar key={o.name} name={o.name} photoUrl={o.photo_url} size="xs" />
                            ))}
                            {d.owners.length > 3 && <span className={styles.muted}>+{d.owners.length - 3}</span>}
                          </span>
                        )}
                      </td>
                      <td><span className={styles.statePill}>{d.state.replace(/_/g, ' ')}</span></td>
                      <td className={styles.muted}>{fmtDate(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.tableFoot}>
              <span className={styles.tableCount}>
                Showing {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} of {filtered.length}
                {filtersOn && overview.deals.length !== filtered.length ? ` (filtered from ${overview.deals.length})` : ''}
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
