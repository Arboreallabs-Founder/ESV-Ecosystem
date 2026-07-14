'use client'

import { useEffect, useState, useTransition } from 'react'
import { getTaskComments, addTaskComment, deleteTaskComment } from '@/app/actions/tasks'
import type { Task, TaskComment } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import styles from '../tasks.module.css'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function TaskDetailModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [comments, setComments] = useState<TaskComment[] | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getTaskComments(task.id).then((c) => { if (!cancelled) setComments(c) }).catch(() => { if (!cancelled) setComments([]) })
    return () => { cancelled = true }
  }, [task.id])

  function post() {
    const body = text.trim()
    if (!body) return
    setError(null)
    startTransition(async () => {
      try {
        await addTaskComment(task.id, body)
        setText('')
        setComments(await getTaskComments(task.id))
      } catch (e) { setError((e as Error).message) }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteTaskComment(id)
      setComments(await getTaskComments(task.id))
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} ${styles.modalWide}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>{task.title}</div>
        <div className={styles.detailMeta}>
          {task.assignee?.name && <span className={styles.metaTag}>{task.assignee.name}</span>}
          <span className={styles.metaTag}>{task.status}</span>
          <span className={`${styles.priority} ${task.priority === 'High' ? styles.priorityHigh : task.priority === 'Medium' ? styles.priorityMedium : styles.priorityLow}`}>{task.priority}</span>
          {task.due_date && <span className={styles.metaTag}>Due {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
        </div>
        {task.description && (
          <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>{task.description}</div>
        )}

        <div className={styles.detailSectionTitle}>Comments</div>
        <div className={styles.commentComposer}>
          <textarea className={styles.textarea} placeholder="Add a comment…" value={text} onChange={(e) => setText(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className={styles.submitBtn} onClick={post} disabled={pending || !text.trim()}>
              {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Posting…</span> : 'Post'}
            </button>
          </div>
          {error && <div style={{ color: 'var(--color-destructive)', fontSize: '0.8125rem' }}>{error}</div>}
        </div>

        {comments === null ? (
          <div className={styles.commentEmpty}>Loading…</div>
        ) : comments.length === 0 ? (
          <div className={styles.commentEmpty}>No comments yet.</div>
        ) : (
          <div className={styles.commentList}>
            {comments.map((c) => (
              <div key={c.id} className={styles.comment}>
                <div className={styles.commentHead}>
                  <span className={styles.commentAuthor}>{c.author?.name ?? 'Someone'}</span>
                  <span className={styles.commentDate}>{formatDateTime(c.created_at)}</span>
                  <button className={styles.commentRemove} onClick={() => remove(c.id)} title="Delete">×</button>
                </div>
                <div className={styles.commentBody}>{c.body}</div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
