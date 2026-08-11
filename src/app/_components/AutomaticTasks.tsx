'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { alertError } from '@/lib/client-errors'
import {
  commentOnAutomaticTask, completeAutomaticTask, reopenAutomaticTask,
} from '@/app/actions/automatic-tasks'
import { AUTO_RULE_LABELS, type AutomaticTask } from '@/lib/automatic-tasks-shared'
import Avatar from './Avatar'
import styles from './automatic-tasks.module.css'

/**
 * Automatic Tasks.
 *
 * Work that fell out of a fund's status rather than being typed by someone, so nobody owns it and
 * anyone can pick it up. The comment box is the important part: these are usually blocked on
 * something outside the team, and saying so is what stops an untouched task looking like nobody
 * did the work.
 *
 * One unowned for a week becomes the deal assignee's — shown here as "escalated", so it is obvious
 * that it stopped being everyone's problem and became one person's.
 */
export default function AutomaticTasks({
  tasks, title = 'Automatic tasks', emptyText,
}: {
  tasks: AutomaticTask[]
  title?: string
  emptyText?: string
}) {
  const router = useRouter()
  const [openComment, setOpenComment] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pending, start] = useTransition()

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      try { await fn(); router.refresh() } catch (err) { alertError(err) }
    })
  }

  if (tasks.length === 0) {
    return emptyText ? <p className={styles.empty}>{emptyText}</p> : null
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <section className={styles.block}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.count}>{tasks.length}</span>
      </div>
      <p className={styles.sub}>
        Raised by a fund&apos;s status, not by a person. Nobody owns one until it has sat a week —
        anyone can do it, and anyone can say why it is stuck.
      </p>

      <div className={styles.list}>
        {tasks.map((t) => {
          const overdue = t.due_date != null && t.due_date < today
          return (
            <div key={t.id} className={styles.task}>
              <div className={styles.taskMain}>
                <div className={styles.taskTitle}>{t.title}</div>
                <div className={styles.taskMeta}>
                  {t.auto_rule && (
                    <span className={styles.ruleTag}>{AUTO_RULE_LABELS[t.auto_rule] ?? t.auto_rule}</span>
                  )}
                  {t.due_date && (
                    <span className={overdue ? styles.dueLate : styles.due}>
                      due {new Date(`${t.due_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {t.entry?.list?.active_deal_id && t.entry.investor && (
                    <Link
                      href={`/active-deals/${t.entry.list.active_deal_id}/fundraise`}
                      className={styles.link}
                    >
                      {t.entry.investor.name}
                    </Link>
                  )}
                  {/* Escalated means it is no longer everybody's. Worth saying out loud. */}
                  {t.assignee && (
                    <span className={styles.owner}>
                      <Avatar name={t.assignee.name ?? '?'} photoUrl={t.assignee.photo_url} size="xs" />
                      {t.assignee.name}
                      {t.escalated_at && <span className={styles.escalated}>escalated</span>}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.taskActions}>
                <button
                  className={styles.ghostBtn}
                  onClick={() => { setOpenComment(openComment === t.id ? null : t.id); setDraft('') }}
                >
                  {t.comment_count ? `Comments (${t.comment_count})` : 'Add a note'}
                </button>
                <button
                  className={styles.doneBtn}
                  disabled={pending}
                  onClick={() => run(() => completeAutomaticTask(t.id))}
                >
                  Done
                </button>
              </div>

              {openComment === t.id && (
                <div className={styles.commentRow}>
                  <input
                    className={styles.input}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && draft.trim()) {
                        run(async () => {
                          await commentOnAutomaticTask(t.id, draft)
                          setDraft(''); setOpenComment(null)
                        })
                      }
                    }}
                    placeholder="Waiting on the fund? Blocked internally? Say so here."
                    autoFocus
                  />
                  <button
                    className={styles.doneBtn}
                    disabled={pending || !draft.trim()}
                    onClick={() => run(async () => {
                      await commentOnAutomaticTask(t.id, draft)
                      setDraft(''); setOpenComment(null)
                    })}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
