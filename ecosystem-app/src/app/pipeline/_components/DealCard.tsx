'use client'

import Link from 'next/link'
import type { Deal } from '@/lib/types'
import styles from '../kanban.module.css'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function DealCard({
  deal,
  isDragging,
  onDragStart,
}: {
  deal: Deal
  isDragging: boolean
  onDragStart: (id: string) => void
}) {
  return (
    <Link
      href={`/pipeline/${deal.id}`}
      className={`${styles.card} ${isDragging ? styles.cardDragging : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(deal.id)
      }}
      onClick={(e) => {
        // prevent navigation when dragging
        if (isDragging) e.preventDefault()
      }}
    >
      <div className={styles.cardCompany}>{deal.company_name}</div>
      <div className={styles.cardMeta}>
        <span className={styles.cardTag}>{deal.sector}</span>
        <span className={styles.cardTag}>{deal.funding_stage}</span>
      </div>
      <div className={styles.cardDate}>{formatDate(deal.created_at)}</div>
    </Link>
  )
}
