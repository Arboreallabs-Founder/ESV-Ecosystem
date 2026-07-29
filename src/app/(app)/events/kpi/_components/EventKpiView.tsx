'use client'

import { Fragment, useState } from 'react'
import type { BulletinEventKpiRow } from '@/lib/types'
import { WikiButton } from '@/app/_components/WikiPanel'
import Avatar from '@/app/_components/Avatar'
import styles from '../../events.module.css'

function formatEventDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiValue} style={accent ? { color: accent } : undefined}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  )
}

export default function EventKpiView({ events }: { events: BulletinEventKpiRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const today = new Date().toISOString().slice(0, 10)

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const totalEvents = events.length
  const completedEvents = events.filter((e) => e.completed).length
  const totalAttendances = events.reduce((sum, e) => sum + e.attendees.length, 0)
  const avgAttendance = totalEvents > 0 ? Math.round((totalAttendances / totalEvents) * 10) / 10 : 0

  const rows = [...events].sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>Event KPIs</div>
            <WikiButton sectionKey="bulletin" />
          </div>
          <div className={styles.pageSub}>Who attended what — {totalEvents} event{totalEvents === 1 ? '' : 's'} tracked</div>
        </div>
      </div>

      <div className={styles.kpiCardRow}>
        <KpiCard label="Total events" value={totalEvents} />
        <KpiCard label="Completed" value={completedEvents} accent="var(--color-success, #16a34a)" />
        <KpiCard label="Total RSVPs" value={totalAttendances} accent="var(--color-primary)" />
        <KpiCard label="Avg. attendance" value={avgAttendance} />
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty} style={{ marginTop: '1.5rem' }}>No events posted yet.</div>
      ) : (
        <div className={styles.kpiTableWrap}>
          <table className={styles.kpiTable}>
            <thead>
              <tr>
                <th className={styles.kpiEventCol}>Event</th>
                <th>Date</th>
                <th>Status</th>
                <th>Attendees</th>
                <th>Media</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const isPast = e.event_date != null && e.event_date < today
                const isOpen = expanded.has(e.id)
                return (
                  <Fragment key={e.id}>
                    <tr>
                      <td className={styles.kpiName}>{e.title}</td>
                      <td>{formatEventDate(e.event_date)}</td>
                      <td>
                        <span className={`${styles.badge} ${e.completed ? styles.badgeCompleted : isPast ? styles.badgeEvent : styles.badgeEvent}`}>
                          {e.completed ? 'Completed' : isPast ? 'Past' : 'Upcoming'}
                        </span>
                      </td>
                      <td>
                        {e.attendees.length === 0 ? (
                          <span className={styles.kpiMuted}>0</span>
                        ) : (
                          <button className={styles.kpiExpandBtn} onClick={() => toggleExpanded(e.id)}>
                            {e.attendees.length} {isOpen ? '▲' : '▼'}
                          </button>
                        )}
                      </td>
                      <td>{e.media_count > 0 ? e.media_count : <span className={styles.kpiMuted}>0</span>}</td>
                    </tr>
                    {isOpen && e.attendees.length > 0 && (
                      <tr>
                        <td colSpan={5} className={styles.kpiAttendeeRow}>
                          <div className={styles.attendeeChips}>
                            {e.attendees.map((a) => (
                              <span key={a.user_id} className={styles.attendeeChip}>
                                <Avatar name={a.name} photoUrl={a.photo_url} size="xs" />
                                {a.name}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
