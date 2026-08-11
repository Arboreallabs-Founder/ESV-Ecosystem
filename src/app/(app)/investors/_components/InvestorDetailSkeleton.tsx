'use client'

import { Skeleton, SkeletonText } from '@/app/_components/Skeleton'
import styles from '../investors.module.css'

/**
 * The drawer, before its record has arrived.
 *
 * The list carries only what the cards need, so opening one costs a round trip. Showing the drawer
 * immediately with the shape of what is coming beats leaving the click apparently ignored for a
 * few hundred milliseconds — and it means the close button works the whole time.
 */
export default function InvestorDetailSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.detailOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.detailPanel} aria-busy="true" aria-label="Loading investor">
        <div className={styles.detailHeader}>
          <Skeleton width={44} height={44} radius={12} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Skeleton width="62%" height={18} />
            <Skeleton width="38%" height={12} />
          </div>
          <button className={styles.detailClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {[70, 54, 88].map((w, i) => <Skeleton key={i} width={w} height={22} radius={100} />)}
          </div>
          <SkeletonText lines={2} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <Skeleton width={96} height={12} />
                <Skeleton width={140} height={12} />
              </div>
            ))}
          </div>
          <SkeletonText lines={3} />
        </div>
      </div>
    </div>
  )
}
