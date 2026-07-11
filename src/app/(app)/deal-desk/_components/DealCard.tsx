'use client'

import type { DeskDeal, DeskActionType } from '@/lib/types'
import { formatInr, formatValuation, initials } from './format'
import RevenueBarChart from './RevenueBarChart'
import styles from './deal-desk.module.css'

// NYT-app-style card. Scan-and-decide surface — deeper detail lives behind a tap.
export default function DealCard({
  deal,
  canReview,
  onOpen,
  onStar,
  onAction,
}: {
  deal: DeskDeal
  canReview: boolean
  onOpen: () => void
  onStar: () => void
  onAction: (type: DeskActionType) => void
}) {
  const visibleThumbs = deal.media.slice(0, 3)
  const extra = deal.media.length - visibleThumbs.length

  return (
    <div className={styles.card} onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}>
      {/* 1. Unseen dot + badges + star */}
      <div className={styles.cardTop}>
        {!deal.seen_status && <span className={styles.unseenDot} aria-label="Unseen" />}
        {deal.sector && <span className={`${styles.badge} ${styles.badgeSector}`}>{deal.sector}</span>}
        {deal.stage && <span className={`${styles.badge} ${styles.badgeStage}`}>{deal.stage}</span>}
        <span className={styles.spacer} />
        {canReview && (
          <button
            className={`${styles.star} ${deal.starred ? styles.starOn : ''}`}
            onClick={(e) => { e.stopPropagation(); onStar() }}
            title={deal.starred ? 'Unstar' : 'Flag for follow-up'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={deal.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        )}
      </div>

      {/* 2. Company name */}
      <h3 className={styles.company}>{deal.company_name}</h3>

      {/* 3. About + location */}
      {deal.about && <div className={styles.aboutLine}>{deal.about}</div>}
      {deal.location && (
        <div className={styles.locLine}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {deal.location}
        </div>
      )}

      {/* 4. Stats row */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Ask</div>
          <div className={styles.statValue}>{formatInr(deal.ask_inr)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Valuation</div>
          <div className={styles.statValue}>{formatValuation(deal.valuation_type, deal.valuation_inr)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Dilution</div>
          <div className={styles.statValue}>{deal.dilution_percent != null ? `${deal.dilution_percent}%` : '—'}</div>
        </div>
      </div>

      {/* 5. Revenue mini chart */}
      {deal.revenue_status === 'Yes' && (
        <RevenueBarChart points={deal.revenue_data} period={deal.revenue_period} />
      )}

      {/* 6. Gallery strip */}
      {deal.media.length > 0 && (
        <div className={styles.gallery}>
          {visibleThumbs.map((m) => (
            m.signed_url
              ? <img key={m.id} className={styles.thumb} src={m.signed_url} alt="" />
              : <div key={m.id} className={styles.thumbMore} />
          ))}
          {extra > 0 && <div className={styles.thumbMore}>+{extra}</div>}
        </div>
      )}

      {/* 7. Founder row */}
      {deal.founders.length > 0 && (
        <div className={styles.founders}>
          {deal.founders.slice(0, 2).map((f, i) => (
            <div key={i} className={styles.founderRow}>
              <div className={styles.avatar}>{initials(f.name)}</div>
              <div>
                <div className={styles.founderName}>{f.name}</div>
                {f.affiliation && <div className={styles.founderAff}>{f.affiliation}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 8. Action row (reviewers only) */}
      {canReview && (
        <div className={styles.actions}>
          {(['reject', 'discuss_in_person', 'need_more_info'] as DeskActionType[]).map((t) => (
            <button
              key={t}
              className={`${styles.actionBtn} ${t === 'reject' ? styles.actionReject : t === 'discuss_in_person' ? styles.actionDiscuss : styles.actionInfo}`}
              onClick={(e) => { e.stopPropagation(); onAction(t) }}
            >
              {t === 'reject' ? 'Reject' : t === 'discuss_in_person' ? 'Discuss' : 'More info'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
