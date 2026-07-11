'use client'

import type { DeskDeal } from '@/lib/types'
import { DESK_DEAL_STATUS_LABELS } from '@/lib/types'
import { formatInr, revenueSummary } from './format'
import styles from './deal-desk.module.css'

// Dense grid for associates to scan/manage their own submissions (spec §7).
export default function DesktopDealTable({
  deals,
  showAssociate,
  onOpen,
}: {
  deals: DeskDeal[]
  showAssociate: boolean
  onOpen: (deal: DeskDeal) => void
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Company</th>
            <th>Sector</th>
            <th>Stage</th>
            <th>Ask</th>
            <th>Revenue</th>
            {showAssociate && <th>Associate</th>}
            <th>Seen</th>
            <th>Status</th>
            <th aria-label="Star"></th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.id} className={styles.rowBtn} onClick={() => onOpen(d)}>
              <td className={styles.tableCompany}>{d.company_name}</td>
              <td>{d.sector ?? '—'}</td>
              <td>{d.stage ?? '—'}</td>
              <td>{formatInr(d.ask_inr)}</td>
              <td>{revenueSummary(d)}</td>
              {showAssociate && <td>{d.associate?.name ?? '—'}</td>}
              <td>
                <span className={`${styles.seenBadge} ${d.seen_status ? styles.seenBadgeSeen : styles.seenBadgeUnseen}`}>
                  {d.seen_status ? 'Seen' : 'Unseen'}
                </span>
              </td>
              <td><span className={`${styles.statusPill} ${statusClass(d.deal_status)}`}>{DESK_DEAL_STATUS_LABELS[d.deal_status]}</span></td>
              <td>{d.starred ? <span className={styles.starOn}>★</span> : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function statusClass(status: DeskDeal['deal_status']): string {
  return { open: styles.statusOpen, rejected: styles.statusRejected, discuss: styles.statusDiscuss, more_info: styles.statusMore_info }[status]
}
