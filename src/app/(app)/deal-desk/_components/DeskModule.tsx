'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { actOnDeal, toggleStar } from '@/app/actions/deal-desk'
import type { DeskActionType, DeskDeal } from '@/lib/types'
import DealCard from './DealCard'
import DesktopDealTable from './DesktopDealTable'
import DealDetailOverlay from './DealDetailOverlay'
import CsvImportModal from './CsvImportModal'
import styles from './deal-desk.module.css'

type View = 'mobile' | 'desktop'
type Tab = 'unseen' | 'seen'

export default function DeskModule({
  deals,
  orgId,
  canReview,
  isOwnBoard,
  title,
  subtitle,
  defaultView,
}: {
  deals: DeskDeal[]
  orgId: string
  canReview: boolean        // founder/admin — can take actions + star
  isOwnBoard: boolean       // associate viewing own board — can import/edit/gallery
  title: string
  subtitle?: string
  defaultView: View
}) {
  const router = useRouter()
  const [view, setView] = useState<View>(defaultView)
  const [tab, setTab] = useState<Tab>('unseen')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [, startTransition] = useTransition()

  const refresh = () => startTransition(() => router.refresh())

  // Look the selected deal up from the live list so it stays fresh across refreshes.
  const selected = useMemo(() => deals.find((d) => d.id === selectedId) ?? null, [deals, selectedId])

  const unseen = deals.filter((d) => !d.seen_status)
  const seen = deals.filter((d) => d.seen_status)
  const feedDeals = view === 'mobile' ? (tab === 'unseen' ? unseen : seen) : deals

  function cardStar(deal: DeskDeal) {
    startTransition(async () => { await toggleStar(deal.id, !deal.starred); router.refresh() })
  }
  function cardAction(deal: DeskDeal, type: DeskActionType) {
    if (type === 'need_more_info') { setSelectedId(deal.id); return } // needs the detail panel
    startTransition(async () => { await actOnDeal(deal.id, { actionType: type }); router.refresh() })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headTitles}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
        <div className={styles.toggle}>
          <button className={`${styles.toggleBtn} ${view === 'mobile' ? styles.toggleBtnActive : ''}`} onClick={() => setView('mobile')}>Cards</button>
          <button className={`${styles.toggleBtn} ${view === 'desktop' ? styles.toggleBtnActive : ''}`} onClick={() => setView('desktop')}>Table</button>
        </div>
        {isOwnBoard && <button className={styles.primaryBtn} onClick={() => setImportOpen(true)}>Import CSV</button>}
      </div>

      {view === 'mobile' && (
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'unseen' ? styles.tabActive : ''}`} onClick={() => setTab('unseen')}>
            Unseen <span className={styles.tabCount}>{unseen.length}</span>
          </button>
          <button className={`${styles.tab} ${tab === 'seen' ? styles.tabActive : ''}`} onClick={() => setTab('seen')}>
            Seen <span className={styles.tabCount}>{seen.length}</span>
          </button>
        </div>
      )}

      {feedDeals.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Nothing here yet</div>
          <div>{isOwnBoard ? 'Import a CSV to add your first deal.' : 'No deals in this view.'}</div>
        </div>
      ) : view === 'mobile' ? (
        <div className={styles.feed}>
          {feedDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              canReview={canReview}
              onOpen={() => setSelectedId(deal.id)}
              onStar={() => cardStar(deal)}
              onAction={(type) => cardAction(deal, type)}
            />
          ))}
        </div>
      ) : (
        <DesktopDealTable deals={feedDeals} showAssociate={canReview} onOpen={(d) => setSelectedId(d.id)} />
      )}

      {selected && (
        <DealDetailOverlay
          deal={selected}
          canReview={canReview}
          isOwner={isOwnBoard}
          orgId={orgId}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
        />
      )}
      {importOpen && <CsvImportModal onClose={() => setImportOpen(false)} onImported={refresh} />}
    </div>
  )
}
