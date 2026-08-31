'use client'

import Link from 'next/link'
import Avatar from '@/app/_components/Avatar'
import HealthBadge from '@/app/_components/HealthBadge'
import type { MandateHealth } from '@/lib/mandate-health'
import styles from '../weekly-update.module.css'

/**
 * The whole team's week on one screen.
 *
 * The card view is person-major and shows one person at a time, which is the right shape for the
 * thing it produces — a WhatsApp message about one person. It is the wrong shape for a review,
 * because two facts a Monday call needs are invisible in it:
 *
 *   - who is doubled up on a mandate, which you cannot see when you can only see one person; and
 *   - mandates nobody is on, which appear on nobody's card and so are simply absent.
 *
 * At the time of writing that second one is 7 of 19 active mandates, and 9 have no update at all.
 * Neither number is reachable by arrowing through people, which is why this view is mandate-major
 * below the roster rather than being a denser carousel.
 */

export type SummaryPerson = {
  id: string
  name: string
  designation: string | null
  photoUrl: string | null
  done: number
  open: number
  mandates: number
  /** How many of those mandates they share with somebody. Drives the roster's shared marker. */
  shared: number
  todos: number
}

export type SummaryMandate = {
  id: string
  name: string
  update: string
  health?: MandateHealth
  people: Array<{ user_id: string; name: string; photo_url: string | null }>
}

function hasNothing(p: SummaryPerson) {
  return p.done === 0 && p.open === 0 && p.mandates === 0 && p.todos === 0
}

export default function WeekSummary({
  people, shared, unowned, silent, weekLabel, onOpenPerson,
}: {
  people: SummaryPerson[]
  /** Mandates with two or more people on them. */
  shared: SummaryMandate[]
  /** Active mandates with no assignee at all. */
  unowned: SummaryMandate[]
  /** Active mandates nobody has posted an update on. */
  silent: SummaryMandate[]
  weekLabel: string
  /** Jumps to this person's card in the other view rather than duplicating the detail here. */
  onOpenPerson: (id: string) => void
}) {
  // People with something to say first, then the quiet ones, each alphabetically. Sorting by
  // volume instead would reshuffle the table every week and make it unreadable as a ritual; this
  // only moves somebody when they cross between having work and having none.
  const roster = [...people].sort((a, b) => {
    const aEmpty = hasNothing(a), bEmpty = hasNothing(b)
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
    return a.name.localeCompare(b.name)
  })

  const reported = roster.filter((p) => !hasNothing(p)).length

  return (
    <div className={styles.summary}>
      {/* ── Everyone ──────────────────────────────────────────────────────── */}
      <section className={styles.sumBlock}>
        <div className={styles.sumHead}>
          <h2 className={styles.sumTitle}>Team</h2>
          <span className={styles.sumNote}>
            {reported} of {roster.length} with something this week
          </span>
        </div>

        <div className={styles.rosterWrap}>
          <table className={styles.roster}>
            <thead>
              <tr>
                <th className={styles.rosterWho}>Person</th>
                <th className={styles.rosterNum}>Done</th>
                <th className={styles.rosterNum}>Open</th>
                <th className={styles.rosterNum}>Mandates</th>
                <th className={styles.rosterNum}>To-dos</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr
                  key={p.id}
                  className={`${styles.rosterRow} ${hasNothing(p) ? styles.rosterQuiet : ''}`}
                  onClick={() => onOpenPerson(p.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${p.name}'s card`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenPerson(p.id) }
                  }}
                >
                  <td className={styles.rosterWho}>
                    <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                    <span className={styles.rosterNames}>
                      <span className={styles.rosterName}>{p.name}</span>
                      {p.designation && <span className={styles.rosterRole}>{p.designation}</span>}
                    </span>
                  </td>
                  {/* A zero is greyed rather than blank: blank reads as missing data, and the
                      difference between "nothing done" and "we do not know" matters on a review. */}
                  <td className={`${styles.rosterNum} ${p.done ? '' : styles.zero}`}>{p.done}</td>
                  <td className={`${styles.rosterNum} ${p.open ? '' : styles.zero}`}>{p.open}</td>
                  <td className={`${styles.rosterNum} ${p.mandates ? '' : styles.zero}`}>
                    {p.mandates}
                    {p.shared > 0 && (
                      <span className={styles.sharedMark} title={`${p.shared} shared with someone else`}>
                        {' '}◆{p.shared}
                      </span>
                    )}
                  </td>
                  <td className={`${styles.rosterNum} ${p.todos ? '' : styles.zero}`}>{p.todos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.sumHint}>Click anyone to open their card for the week of {weekLabel}.</p>
      </section>

      {/* ── Doubled up ────────────────────────────────────────────────────── */}
      <section className={styles.sumBlock}>
        <div className={styles.sumHead}>
          <h2 className={styles.sumTitle}>Shared mandates</h2>
          <span className={styles.sumCount}>{shared.length}</span>
        </div>
        {shared.length === 0 ? (
          <p className={styles.sumEmpty}>Nobody is doubled up on a mandate.</p>
        ) : (
          <ul className={styles.sharedList}>
            {shared.map((m) => (
              <li key={m.id} className={styles.sharedItem}>
                <Link href={`/active-deals/${m.id}`} className={styles.sharedLink}>
                  <span className={styles.sharedTop}>
                    <span className={styles.sharedName}>{m.name}</span>
                    {m.health && <HealthBadge health={m.health} compact />}
                    <span className={styles.sharedFaces}>
                      {m.people.map((u) => (
                        <span key={u.user_id} className={styles.face} title={u.name}>
                          <Avatar name={u.name} photoUrl={u.photo_url} size="sm" />
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className={m.update ? styles.sharedUpdate : styles.sharedNone}>
                    {m.update || '(no update yet)'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── The gaps ──────────────────────────────────────────────────────────
          Both lists are derived from the same rows as everything above, so they empty themselves
          as the gaps get filled. Nothing here is stored or needs maintaining. */}
      {(unowned.length > 0 || silent.length > 0) && (
        <section className={styles.sumBlock}>
          <div className={styles.sumHead}>
            <h2 className={styles.sumTitle}>Needs attention</h2>
          </div>

          {unowned.length > 0 && (
            <div className={styles.gapGroup}>
              <div className={styles.gapLabel}>
                No owner <span className={styles.sumCount}>{unowned.length}</span>
              </div>
              <div className={styles.gapChips}>
                {unowned.map((m) => (
                  <Link key={m.id} href={`/active-deals/${m.id}`} className={styles.gapChip}>
                    {m.name}
                    {m.health && <HealthBadge health={m.health} compact />}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {silent.length > 0 && (
            <div className={styles.gapGroup}>
              <div className={styles.gapLabel}>
                No update posted <span className={styles.sumCount}>{silent.length}</span>
              </div>
              <div className={styles.gapChips}>
                {silent.map((m) => (
                  <Link key={m.id} href={`/active-deals/${m.id}`} className={styles.gapChip}>
                    {m.name}
                    {m.health && <HealthBadge health={m.health} compact />}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
