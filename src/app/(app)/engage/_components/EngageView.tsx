'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteKudos } from '@/app/actions/kudos'
import type { Kudos } from '@/lib/types'
import GiveKudosModal from './GiveKudosModal'
import styles from '../engage.module.css'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function EngageView({ feed, recipients, currentUserId, canModerate }: {
  feed: Kudos[]; recipients: Array<{ id: string; name: string }>; currentUserId: string; canModerate: boolean
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [, startTransition] = useTransition()

  function handleDelete(id: string) {
    if (!confirm('Delete this kudos?')) return
    startTransition(async () => { await deleteKudos(id); router.refresh() })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Engage</div>
          <div className={styles.pageSub}>Give a shout-out to a colleague</div>
        </div>
        <button className={styles.primaryBtn} onClick={() => setShowModal(true)}>+ Give kudos</button>
      </div>

      <div className={styles.content}>
        {feed.length === 0 ? (
          <div className={styles.empty}>No kudos yet — be the first to give one.</div>
        ) : (
          <div className={styles.list}>
            {feed.map((k) => {
              const canDelete = canModerate || k.giver_id === currentUserId
              return (
                <div key={k.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div>
                      <div className={styles.cardNames}>
                        {k.giver?.name ?? 'Someone'} <span className={styles.cardArrow}>→</span> {k.recipient?.name ?? 'Someone'}
                        {k.category && <span className={styles.badge} style={{ marginLeft: '0.5rem' }}>{k.category}</span>}
                      </div>
                      <div className={styles.cardMessage}>{k.message}</div>
                      <div className={styles.cardFoot}>{formatDate(k.created_at)}</div>
                    </div>
                    {canDelete && <button className={styles.iconBtn} onClick={() => handleDelete(k.id)}>Delete</button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <GiveKudosModal recipients={recipients} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); router.refresh() }} />
      )}
    </div>
  )
}
