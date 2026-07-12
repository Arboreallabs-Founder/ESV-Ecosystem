'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { actOnDeal, toggleStar } from '@/app/actions/deal-desk'
import type { DeskActionType, DeskDeal } from '@/lib/types'
import DealCard from './DealCard'
import DealStack from './DealStack'
import DesktopDealTable from './DesktopDealTable'
import DealDetailOverlay from './DealDetailOverlay'
import CsvImportModal from './CsvImportModal'
import styles from './deal-desk.module.css'

type View = 'cards' | 'grid' | 'stack' | 'table'
type Tab = 'unseen' | 'seen'

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'grid', label: 'Grid' },
  { value: 'stack', label: 'Stack' },
  { value: 'table', label: 'Table' },
]

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
  const selected = useMemo(() => deals.find((d) => d.id === selectedId) ?? null, [deals, selectedId])

  const unseen = deals.filter((d) => !d.seen_status)
  const seen = deals.filter((d) => d.seen_status)
  const isCardView = view !== 'table' // card-based views share the Unseen/Seen tabs
  const feedDeals = view === 'table' ? deals : tab === 'unseen' ? unseen : seen

  function cardStar(deal: DeskDeal) {
    startTransition(async () => { await toggleStar(deal.id, !deal.starred); router.refresh() })
  }
  function cardAction(deal: DeskDeal, type: DeskActionType) {
    if (type === 'need_more_info') { setSelectedId(deal.id); return } // needs the detail panel
    startTransition(async () => { await actOnDeal(deal.id, { actionType: type }); router.refresh() })
  }

  function renderCard(deal: DeskDeal) {
    return (
      <DealCard
        key={deal.id}
        deal={deal}
        canReview={canReview}
        onOpen={() => setSelectedId(deal.id)}
        onStar={() => cardStar(deal)}
        onAction={(type) => cardAction(deal, type)}
      />
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headTitles}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
        <div className={styles.toggle}>
          {VIEW_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`${styles.toggleBtn} ${view === o.value ? styles.toggleBtnActive : ''}`}
              onClick={() => setView(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {isOwnBoard && <button className={styles.primaryBtn} onClick={() => setImportOpen(true)}>Import CSV</button>}
      </div>

      {isCardView && (
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
      ) : view === 'table' ? (
        <DesktopDealTable deals={feedDeals} showAssociate={canReview} onOpen={(d) => setSelectedId(d.id)} />
      ) : view === 'grid' ? (
        <div className={styles.cardGrid}>{feedDeals.map(renderCard)}</div>
      ) : view === 'stack' ? (
        <DealStack
          deals={feedDeals}
          canReview={canReview}
          onOpen={(id) => setSelectedId(id)}
          onStar={cardStar}
        />
      ) : (
        <div className={styles.feed}>{feedDeals.map(renderCard)}</div>
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
