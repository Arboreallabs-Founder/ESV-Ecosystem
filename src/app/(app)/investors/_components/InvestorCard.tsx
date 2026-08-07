'use client'

import type { Investor, ServiceType } from '@/lib/types'
import { pocCoverage, POC_COVERAGE_LABELS, SERVICE_TYPE_LABELS } from '@/lib/types'
import { countryFlagCode } from '@/lib/countries'
import styles from '../investors.module.css'

// Flat outline icons (matching the sidebar's icon style) instead of emoji — emoji render
// inconsistently across OSes/browsers, same issue we hit with country flags.
function ServiceTypeIcon({ type }: { type: ServiceType }) {
  const common = {
    viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor',
    strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    width: 16, height: 16,
  }
  switch (type) {
    case 'vc_fund':
      return <svg {...common}><path d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>
    case 'angel_fund':
      return (
        <svg {...common}>
          <circle cx="6" cy="7" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="17" r="2" />
          <line x1="7.4" y1="8.6" x2="10.6" y2="15.2" /><line x1="16.6" y1="8.6" x2="13.4" y2="15.2" />
          <line x1="8" y1="7" x2="16" y2="7" />
        </svg>
      )
    case 'family_office':
      return <svg {...common}><polyline points="4,11 12,4 20,11" /><rect x="6" y="10" width="12" height="9" /><line x1="12" y1="19" x2="12" y2="14" /></svg>
    case 'angel_investor':
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><polyline points="5,20 7.5,13.5 16.5,13.5 19,20" /></svg>
    case 'debt_fund':
      return <svg {...common}><rect x="2.5" y="7" width="19" height="11" rx="1.5" /><circle cx="12" cy="12.5" r="2.5" /></svg>
    case 'corporate_vc':
      return (
        <svg {...common}>
          <path d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      )
    case 'private_equity':
      return <svg {...common}><rect x="3" y="8" width="18" height="12" rx="1.5" /><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><line x1="3" y1="13" x2="21" y2="13" /></svg>
    case 'growth_equity':
      return <svg {...common}><rect x="4" y="14" width="3" height="6" /><rect x="10.5" y="10" width="3" height="10" /><rect x="17" y="5" width="3" height="15" /></svg>
    case 'fund_of_funds':
      return <svg {...common}><rect x="4" y="5" width="16" height="4" rx="1" /><rect x="4" y="10" width="16" height="4" rx="1" /><rect x="4" y="15" width="16" height="4" rx="1" /></svg>
    case 'accelerator':
      return <svg {...common}><polygon points="12,2 4,13 11,13 9,22 20,10 13,10" /></svg>
    case 'sovereign_wealth':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><line x1="3" y1="12" x2="21" y2="12" /></svg>
    case 'merchant_bank':
      return (
        <svg {...common}>
          <polyline points="4,9 12,4 20,9" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="20" x2="20" y2="20" />
          <line x1="6" y1="9" x2="6" y2="17" /><line x1="10" y1="9" x2="10" y2="17" /><line x1="14" y1="9" x2="14" y2="17" /><line x1="18" y1="9" x2="18" y2="17" />
        </svg>
      )
    default:
      return null
  }
}

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
  debt_fund: '#b03a2e',
  corporate_vc: '#2e6f95',
  private_equity: '#5c4a72',
  growth_equity: '#3f7d4f',
  fund_of_funds: '#8a6d3b',
  accelerator: '#c77d2e',
  sovereign_wealth: '#4a5a75',
  merchant_bank: '#6b4226',
}

export default function InvestorCard({ investor, onClick }: { investor: Investor; onClick: () => void }) {
  const coverage = pocCoverage(investor.contacts)
  const ticket = formatTicket(investor.ticket_size_min, investor.ticket_size_max)
  const visibleSectors = investor.sectors.slice(0, 3)
  const extraSectors = investor.sectors.length - visibleSectors.length
  const color = SERVICE_TYPE_COLOR[investor.service_type]

  return (
    <div
      className={styles.card}
      style={{ borderLeftColor: color, borderLeftWidth: '3px' }}
      onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardTitleRow}>
          <span className={styles.avatar} style={investor.logo_url ? undefined : { background: color + '1a', color }}>
            {/* A real logo beats a generic type icon; the icon remains the fallback. */}
            {investor.logo_url
              ? <img src={investor.logo_url} alt="" className={styles.avatarImg} />
              : <ServiceTypeIcon type={investor.service_type} />}
          </span>
          <div className={styles.cardTitle}>{investor.name}</div>
        </div>
        <span
          className={styles.serviceTypeBadge}
          style={{ background: color + '1a', color }}
        >
          {SERVICE_TYPE_LABELS[investor.service_type]}
        </span>
        {/* Funds only: an angel is their own contact, so "needs a POC" is meaningless for them. */}
        {investor.service_type !== 'angel_investor' && coverage !== 'covered' && (
          <span className={coverage === 'none' || coverage === 'all_left' ? styles.pocGap : styles.pocSoft}>
            {POC_COVERAGE_LABELS[coverage]}
          </span>
        )}
      </div>

      {(investor.country || investor.stage) && (
        <div className={styles.cardMeta}>
          {investor.country && countryFlagCode(investor.country) && (
            <span className={`fi fi-${countryFlagCode(investor.country)} ${styles.countryFlag}`} />
          )}
          {investor.country && <span>{investor.country}</span>}
          {investor.country && investor.country !== 'India' && <span className={styles.foreignBadge}>Foreign</span>}
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
