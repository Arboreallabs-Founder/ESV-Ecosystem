'use client'

import type { Deal, DealStage } from '@/lib/types'
import DealCard from './DealCard'
import styles from '../kanban.module.css'

const CLOSED_STAGES = ['Closed Success', 'Closed Dead']

export default function KanbanColumn({
  stage,
  deals,
  dragDealId,
  isOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
}: {
  stage: DealStage
  deals: Deal[]
  dragDealId: string | null
  isOver: boolean
  onDragStart: (id: string) => void
  onDragOver: (stage: DealStage) => void
  onDrop: (stage: DealStage) => void
  onDragLeave: () => void
}) {
  const isClosed = CLOSED_STAGES.includes(stage)

  return (
    <div
      className={`${styles.column} ${isOver ? styles.columnOver : ''} ${isClosed ? styles.columnClosed : ''}`}
      onDragOver={(e) => { e.preventDefault(); onDragOver(stage) }}
      onDrop={() => onDrop(stage)}
      onDragLeave={onDragLeave}
    >
      <div className={styles.columnHeader}>
        <span className={styles.columnTitle}>{stage}</span>
        <span className={styles.columnCount}>{deals.length}</span>
      </div>
      <div className={styles.columnBody}>
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            isDragging={dragDealId === deal.id}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  )
}
