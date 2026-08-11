import Link from 'next/link'
import type { DeskAssociateSummary } from '@/lib/types'
import { initials } from './format'
import styles from './deal-desk.module.css'
import { WikiButton } from '@/app/_components/WikiPanel'

// Reviewer landing: pick an associate to open their card feed (spec §2).
// `selfAuthorId` is set for reviewers who can also author (admins) — gives them a direct
// link to their own board.
export default function DeskRoster({
  associates,
  selfAuthorId,
}: {
  associates: DeskAssociateSummary[]
  selfAuthorId?: string
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headTitles}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 className={styles.title}>Deal Desk</h1>
            <WikiButton sectionKey="dealDesk" />
          </div>
          <div className={styles.subtitle}>Central hub to review and manage every deal on the desk.</div>
        </div>
        {selfAuthorId && (
          <Link href={`/deal-desk/${selfAuthorId}`} className={styles.primaryBtn} style={{ textDecoration: 'none' }}>
            My cards
          </Link>
        )}
      </div>

      {associates.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No associates yet</div>
          <div>Associates will appear here once they’re added to your organization.</div>
        </div>
      ) : (
        <div className={styles.roster}>
          {associates.map((a) => (
            <Link key={a.id} href={`/deal-desk/${a.id}`} className={styles.rosterCard}>
              <div className={styles.rosterAvatar}>{a.photo_url ? <img src={a.photo_url} alt="" /> : initials(a.name)}</div>
              <div>
                <div className={styles.rosterName}>{a.name}</div>
                <div className={styles.rosterMeta}>
                  {a.seen_count + a.unseen_count} deal{a.seen_count + a.unseen_count === 1 ? '' : 's'}
                  {a.starred_count > 0 && ` · ★ ${a.starred_count}`}
                </div>
              </div>
              {a.unseen_count > 0 && <span className={styles.rosterUnseen}>{a.unseen_count}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
