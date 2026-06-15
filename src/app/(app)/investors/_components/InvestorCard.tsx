'use client'

import type { Investor, ServiceType } from '@/lib/types'
import { SERVICE_TYPE_LABELS } from '@/lib/types'
import styles from '../investors.module.css'

function formatTicket(min: number | null, max: number | null): string {
  if (!min && !max) return ''
  function fmt(n: number) {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(0)}Cr`
    if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`
    return `₹${n.toLocaleString('en-IN')}`
  }
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `Up to ${fmt(max!)}`
}

const SERVICE_TYPE_COLOR: Record<ServiceType, string> = {
  vc_fund: 'var(--color-primary)',
  angel_fund: '#e07b39',
  family_office: '#2d8c6e',
  angel_investor: '#7b5ea7',
}

export default function InvestorCard({ investor, onClick }: { investor: Investor; onClick: () => void }) {
  const ticket = formatTicket(investor.ticket_size_min, investor.ticket_size_max)
  const visibleSectors = investor.sectors.slice(0, 3)
  const extraSectors = investor.sectors.length - visibleSectors.length

  return (
    <div className={styles.card} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className={styles.cardTop}>
        <div className={styles.cardTitle}>{investor.name}</div>
        <span
          className={styles.serviceTypeBadge}
          style={{
            background: SERVICE_TYPE_COLOR[investor.service_type] + '1a',
            color: SERVICE_TYPE_COLOR[investor.service_type],
          }}
        >
          {SERVICE_TYPE_LABELS[investor.service_type]}
        </span>
      </div>

      {(investor.country || investor.stage) && (
        <div className={styles.cardMeta}>
          {investor.country && <span>{investor.country}</span>}
          {investor.country && investor.stage && <span>·</span>}
          {investor.stage && <span>{investor.stage}</span>}
        </div>
      )}

      {investor.sectors.length > 0 && (
        <div className={styles.cardSectors}>
          {visibleSectors.map((s) => (
            <span key={s} className={styles.sectorChip}>{s}</span>
          ))}
          {extraSectors > 0 && (
            <span className={styles.sectorChipMore}>+{extraSectors}</span>
          )}
        </div>
      )}

      <div className={styles.cardFooter}>
        {ticket && <span className={styles.ticketRange}>{ticket}</span>}
        {investor.esv_poc?.name && (
          <span className={styles.pocChip}>{investor.esv_poc.name}</span>
        )}
      </div>
    </div>
  )
}
