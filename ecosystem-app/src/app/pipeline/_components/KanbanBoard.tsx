'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { moveDeal } from '@/app/actions/deals'
import { DEAL_STAGES, type Deal, type DealStage } from '@/lib/types'
import KanbanColumn from './KanbanColumn'
import DealTable from './DealTable'
import NewDealModal from './NewDealModal'
import styles from '../kanban.module.css'

type ViewMode = 'kanban' | 'table'

export default function KanbanBoard({
  initialDeals,
  userRole,
}: {
  initialDeals: Deal[]
  userRole: string
}) {
  const router = useRouter()
  const [deals, setDeals] = useState(initialDeals)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('pipeline-view') as ViewMode) ?? 'kanban'
    return 'kanban'
  })
  const [dragDealId, setDragDealId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<DealStage | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => { setDeals(initialDeals) }, [initialDeals])

  function switchView(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem('pipeline-view', mode)
  }

  function handleDragStart(dealId: string) { setDragDealId(dealId) }
  function handleDragOver(stage: DealStage) { setOverStage(stage) }
  function handleDragLeave() { setOverStage(null) }

  function handleDrop(toStage: DealStage) {
    setOverStage(null)
    if (!dragDealId) return
    const deal = deals.find((d) => d.id === dragDealId)
    if (!deal || deal.current_stage === toStage) { setDragDealId(null); return }
    const fromStage = deal.current_stage
    setDragDealId(null)
    setDeals((prev) => prev.map((d) => d.id === deal.id ? { ...d, current_stage: toStage } : d))
    startTransition(async () => { await moveDeal(deal.id, toStage, fromStage) })
  }

  function handleModalClose() { setIsModalOpen(false); router.refresh() }

  const canCreateDeal = userRole !== 'franchise_partner'

  return (
    <>
      <div className={styles.pipelineHeader}>
        <div>
          <h1 className={styles.pipelineTitle}>Deal Pipeline</h1>
          <p className={styles.pipelineSub}>{deals.length} deal{deals.length !== 1 ? 's' : ''} · drag cards or use table view</p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${viewMode === 'kanban' ? styles.viewBtnActive : ''}`} onClick={() => switchView('kanban')}>Kanban</button>
            <button className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`} onClick={() => switchView('table')}>Table</button>
          </div>
          {canCreateDeal && (
            <button className={styles.newDealBtn} onClick={() => setIsModalOpen(true)}>+ New Deal</button>
          )}
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className={styles.boardWrap}>
          <div className={styles.board}>
            {DEAL_STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                deals={deals.filter((d) => d.current_stage === stage)}
                dragDealId={dragDealId}
                isOver={overStage === stage}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={handleDragLeave}
              />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 1.75rem 1.5rem' }}>
          <DealTable deals={deals} />
        </div>
      )}

      {isModalOpen && <NewDealModal onClose={handleModalClose} />}
    </>
  )
}
