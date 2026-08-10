'use client'

import { useState, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import { useRouter } from 'next/navigation'
import { addDealUpdate, deleteDealUpdate } from '@/app/actions/active-deal-updates'
import { formatDateTimeIstLong } from '@/lib/format-datetime'
import Avatar from '@/app/_components/Avatar'
import type { ActiveDealUpdate } from '@/lib/types'
import styles from '../active-deals.module.css'

/**
 * Latest-update thread for a deal. Newest first, because the newest *is* the deal's status —
 * it's what the Weekly Update prints beside the deal name.
 *
 * `canPost` mirrors the RLS policy (founder/admin, or someone assigned to the deal); the server
 * rejects anyone else regardless, this just avoids offering a box that can't be used.
 */
export default function DealUpdates({
  activeDealId,
  updates: initialUpdates,
  canPost,
  currentUserId,
  isAdmin,
}: {
  activeDealId: string
  updates: ActiveDealUpdate[]
  canPost: boolean
  currentUserId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [updates, setUpdates] = useState(initialUpdates)
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()

  function handlePost() {
    const text = body.trim()
    if (!text) return
    setBody('')
    startTransition(async () => {
      try {
        const created = await addDealUpdate(activeDealId, text)
        setUpdates((prev) => [created, ...prev])
      } catch (err) {
        setBody(text)
        alertError(err)
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this update?')) return
    const previous = updates
    setUpdates((prev) => prev.filter((u) => u.id !== id))
    startTransition(async () => {
      try { await deleteDealUpdate(id, activeDealId) }
      catch (err) { setUpdates(previous); alertError(err); router.refresh() }
    })
  }

  return (
    <div className={styles.dashCard}>
      <div className={styles.detailSectionTitle}>Latest Update</div>
      <p className={styles.updateHint}>
        Post updates as they come in. The most recent one shows against this deal in the weekly update.
      </p>

      {canPost && (
        <div className={styles.updateComposer}>
          <textarea
            className={styles.updateInput}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's the latest on this deal?"
            rows={3}
          />
          <div className={styles.updateComposerActions}>
            <button
              type="button"
              className={styles.updatePostBtn}
              onClick={handlePost}
              disabled={isPending || !body.trim()}
            >
              {isPending ? 'Posting…' : 'Post Update'}
            </button>
          </div>
        </div>
      )}

      {updates.length === 0 ? (
        <div className={styles.detailEmpty}>No updates yet.</div>
      ) : (
        <div className={styles.updateThread}>
          {updates.map((u, i) => (
            <div key={u.id} className={styles.updateItem}>
              <div className={styles.updateDot} />
              {i < updates.length - 1 && <div className={styles.updateLine} />}
              <div className={styles.updateContent}>
                <div className={styles.updateHead}>
                  <Avatar name={u.created_by_user?.name} photoUrl={u.created_by_user?.photo_url} size="xs" />
                  <span className={styles.updateAuthor}>{u.created_by_user?.name ?? 'Someone'}</span>
                  <span className={styles.updateTime}>{formatDateTimeIstLong(u.created_at)}</span>
                  {i === 0 && <span className={styles.updateLatestTag}>Latest</span>}
                  {(isAdmin || u.created_by === currentUserId) && (
                    <button type="button" className={styles.updateDelete} onClick={() => handleDelete(u.id)}>
                      Delete
                    </button>
                  )}
                </div>
                <div className={styles.updateBody}>{u.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
