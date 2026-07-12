'use client'

import { useState } from 'react'
import type { DeskDeal } from '@/lib/types'
import { formatInr, arrRunRate, revenueGrowth, sectorBadge } from './format'
import styles from './deal-desk.module.css'

// Layout constants for the stacked→spread animation.
const CARD_H = 132
const GAP = 12
const PEEK = 14      // collapsed vertical offset per card behind the top one
const PEEK_MAX = 4   // cards deeper than this pile at the same spot / fade out

// A stack of condensed glass cards that fan out on click. Tapping a fanned card opens
// the full detail overlay. (Deal cards are tall, so the stack uses a compact summary.)
export default function DealStack({
  deals,
  canReview,
  onOpen,
  onStar,
}: {
  deals: DeskDeal[]
  canReview: boolean
  onOpen: (id: string) => void
  onStar: (deal: DeskDeal) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const collapsedHeight = CARD_H + Math.min(deals.length - 1, PEEK_MAX) * PEEK + 8
  const expandedHeight = deals.length * (CARD_H + GAP) + 4
  const height = expanded ? expandedHeight : collapsedHeight

  return (
    <div className={styles.stackShell}>
      <div
        className={styles.stack}
        style={{ height }}
        onClick={() => { if (!expanded) setExpanded(true) }}
        role={expanded ? undefined : 'button'}
        tabIndex={expanded ? undefined : 0}
        onKeyDown={(e) => { if (!expanded && e.key === 'Enter') setExpanded(true) }}
      >
        {deals.map((deal, i) => {
          const clamped = Math.min(i, PEEK_MAX)
          const top = expanded ? i * (CARD_H + GAP) : clamped * PEEK
          const scale = expanded ? 1 : 1 - clamped * 0.03
          const opacity = expanded ? 1 : i <= PEEK_MAX ? 1 - clamped * 0.14 : 0
          return (
            <div
              key={deal.id}
              className={styles.stackItem}
              style={{
                top,
                transform: `scale(${scale})`,
                opacity,
                zIndex: expanded ? i + 1 : deals.length - i,
                pointerEvents: !expanded && i > 0 ? 'none' : 'auto',
              }}
              onClick={(e) => { if (expanded) { e.stopPropagation(); onOpen(deal.id) } }}
            >
              <StackCard deal={deal} canReview={canReview} onStar={() => onStar(deal)} />
            </div>
          )
        })}
      </div>

      {expanded ? (
        <button className={styles.showLess} onClick={() => setExpanded(false)}>Show less</button>
      ) : deals.length > 1 ? (
        <div className={styles.stackHint}>{deals.length} cards · click to spread</div>
      ) : null}
    </div>
  )
}

function StackCard({ deal, canReview, onStar }: { deal: DeskDeal; canReview: boolean; onStar: () => void }) {
  const arr = arrRunRate(deal)
  const growth = revenueGrowth(deal.revenue_data, deal.revenue_period)

  return (
    <div className={styles.stackCard}>
      <div className={styles.stackCardTop}>
        {!deal.seen_status && <span className={styles.unseenDot} aria-label="Unseen" />}
        {deal.sector && (
          <span className={`${styles.badge} ${styles.badgeSector}`} style={sectorBadge(deal.sector) ?? undefined}>{deal.sector}</span>
        )}
        {deal.stage && <span className={`${styles.badge} ${styles.badgeStage}`}>{deal.stage}</span>}
        <span className={styles.spacer} />
        {canReview && (
          <button
            className={`${styles.star} ${deal.starred ? styles.starOn : ''}`}
            onClick={(e) => { e.stopPropagation(); onStar() }}
            title={deal.starred ? 'Unstar' : 'Flag for follow-up'}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill={deal.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        )}
      </div>

      <h3 className={styles.stackCompany}>{deal.company_name}</h3>
      {deal.about && <div className={styles.stackAbout}>{deal.about}</div>}

      <div className={styles.stackStats}>
        <span><strong>{formatInr(deal.ask_inr)}</strong> ask</span>
        {arr != null && <span><strong>{formatInr(arr)}</strong> ARR</span>}
        {growth && (
          <span className={growth.pct > 0 ? styles.stackGrowthUp : growth.pct < 0 ? styles.stackGrowthDown : ''}>
            {growth.pct > 0 ? '▲ ' : growth.pct < 0 ? '▼ ' : ''}{growth.label}
          </span>
        )}
      </div>
    </div>
  )
}
