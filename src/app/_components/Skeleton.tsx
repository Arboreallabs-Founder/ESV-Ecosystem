import styles from './skeleton.module.css'

/**
 * Loading placeholders.
 *
 * The point of a skeleton is not "something is happening" — a spinner says that. It is to hold the
 * shape of what is coming, so the page does not jump when it arrives and the eye already knows
 * where to look. So these are built to match the real layout of each screen rather than being a
 * generic grey box, and every route's loading.tsx composes them into roughly its own shape.
 *
 * Server components, deliberately: a loading state that ships JavaScript to say "wait" has the
 * cost backwards.
 */

/** One bar. Width takes any CSS length or percentage. */
export function Skeleton({
  width = '100%', height = 14, radius = 6, className = '',
}: {
  width?: number | string
  height?: number | string
  radius?: number | string
  className?: string
}) {
  return (
    <span
      className={`${styles.bar} ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

/** A paragraph. The last line is short, because real ones are. */
export function SkeletonText({ lines = 3, width = '100%' }: { lines?: number; width?: number | string }) {
  return (
    <span className={styles.stack} style={{ width }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? '62%' : '100%'} />
      ))}
    </span>
  )
}

/** The page's own heading and subtitle, which every screen has. */
export function SkeletonPageHead({ action = false }: { action?: boolean }) {
  return (
    <div className={styles.head}>
      <div className={styles.headText}>
        <Skeleton width={210} height={26} />
        <Skeleton width={320} height={13} />
      </div>
      {action && <Skeleton width={132} height={38} radius={10} />}
    </div>
  )
}

/** A grid of cards, matching the `repeat(auto-fill, minmax(Npx, 1fr))` the real pages use. */
export function SkeletonCards({
  count = 6, minWidth = 320, lines = 2, chips = 2,
}: {
  count?: number
  minWidth?: number
  lines?: number
  chips?: number
}) {
  return (
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.card}>
          <div className={styles.cardHead}>
            <Skeleton width={38} height={38} radius={10} />
            <div className={styles.cardTitle}>
              <Skeleton width="70%" height={15} />
              <Skeleton width="45%" height={11} />
            </div>
          </div>
          {lines > 0 && <SkeletonText lines={lines} />}
          {chips > 0 && (
            <div className={styles.chips}>
              {Array.from({ length: chips }, (_, c) => (
                <Skeleton key={c} width={62 + c * 18} height={20} radius={100} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** The KPI strip that sits above most dashboards. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={styles.stats}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.stat}>
          <Skeleton width={84} height={11} />
          <Skeleton width={120} height={28} />
        </div>
      ))}
    </div>
  )
}

/** A table, with a header row that reads as one. */
export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className={styles.table}>
      <div className={`${styles.row} ${styles.rowHead}`}>
        {Array.from({ length: cols }, (_, c) => (
          <Skeleton key={c} width={c === 0 ? '32%' : '14%'} height={11} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className={styles.row}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} width={c === 0 ? '32%' : '14%'} height={13} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** A vertical list of rows — tasks, requests, referrals. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className={styles.rows}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.listRow}>
          <Skeleton width={32} height={32} radius="50%" />
          <div className={styles.listRowText}>
            <Skeleton width="42%" height={13} />
            <Skeleton width="26%" height={11} />
          </div>
          <Skeleton width={72} height={22} radius={100} />
        </div>
      ))}
    </div>
  )
}

/** A kanban board: columns of cards. */
export function SkeletonBoard({ columns = 4, perColumn = 3 }: { columns?: number; perColumn?: number }) {
  return (
    <div className={styles.board}>
      {Array.from({ length: columns }, (_, c) => (
        <div key={c} className={styles.column}>
          <Skeleton width="55%" height={12} />
          {Array.from({ length: perColumn }, (_, i) => (
            <div key={i} className={styles.boardCard}>
              <Skeleton width="80%" height={13} />
              <Skeleton width="50%" height={11} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** The whole page: heading plus whatever shape follows. */
export default function SkeletonPage({
  action = false, children,
}: {
  action?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className={styles.page}>
      <SkeletonPageHead action={action} />
      {children}
    </div>
  )
}
