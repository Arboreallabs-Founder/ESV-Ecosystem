'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteKudos } from '@/app/actions/kudos'
import type { Kudos } from '@/lib/types'
import GiveKudosModal from './GiveKudosModal'
import KudosCard from './KudosCard'
import { artFor } from './kudos-meta'
import styles from '../engage.module.css'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/* Sealed envelope shown in the grid. Clicking it opens the full card. */
function Envelope({ kudos, onOpen }: { kudos: Kudos; onOpen: () => void }) {
  const art = artFor(kudos.category)
  return (
    <button
      type="button"
      className={styles.env}
      style={{ background: art.gradient }}
      onClick={onOpen}
      aria-label={`Open kudos for ${kudos.recipient?.name ?? 'someone'}`}
    >
      <span className={styles.envFlap} aria-hidden="true" />
      <span className={styles.envSeal} aria-hidden="true">
        <span className={styles.envSealIcon}>{art.icon}</span>
      </span>
      <span className={styles.envMeta}>
        <span className={styles.envTo}>{kudos.recipient?.name ?? 'Someone'}</span>
        <span className={styles.envFrom}>from {kudos.giver?.name ?? 'Someone'}</span>
      </span>
      <span className={styles.envFoot}>
        <span className={styles.envCat} style={{ color: art.accent }}>{art.label}</span>
        <span className={styles.envDate}>{formatDate(kudos.created_at)}</span>
      </span>
      <span className={styles.envHint} aria-hidden="true">Open</span>
    </button>
  )
}

export default function EngageView({ feed, recipients, currentUserId, canModerate }: {
  feed: Kudos[]; recipients: Array<{ id: string; name: string }>; currentUserId: string; canModerate: boolean
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [opened, setOpened] = useState<Kudos | null>(null)
  const [, startTransition] = useTransition()

  // Close the opened card on Escape, and stop the page scrolling behind it.
  useEffect(() => {
    if (!opened) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpened(null) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [opened])

  function handleDelete(id: string) {
    if (!confirm('Delete this kudos?')) return
    setOpened(null)
    startTransition(async () => { await deleteKudos(id); router.refresh() })
  }

  const canDeleteOpened = opened ? (canModerate || opened.giver_id === currentUserId) : false

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
          <div className={styles.grid}>
            {feed.map((k) => (
              <Envelope key={k.id} kudos={k} onOpen={() => setOpened(k)} />
            ))}
          </div>
        )}
      </div>

      {/* Opened kudos — the envelope unseals and the card lifts out of it. */}
      {opened && (
        <div className={styles.openOverlay} onMouseDown={(e) => e.target === e.currentTarget && setOpened(null)}>
          <div className={styles.stage}>
            <div className={styles.envOpen} aria-hidden="true" style={{ background: artFor(opened.category).gradient }}>
              <span className={styles.envOpenFlap} style={{ background: artFor(opened.category).gradient }} />
              <span className={styles.envOpenPocket} style={{ background: artFor(opened.category).gradient }} />
            </div>

            <div className={styles.cardReveal}>
              <KudosCard kudos={opened} />
            </div>

            <div className={styles.openActions}>
              {canDeleteOpened && (
                <button className={styles.openDelete} onClick={() => handleDelete(opened.id)}>Delete</button>
              )}
              <button className={styles.openClose} onClick={() => setOpened(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <GiveKudosModal recipients={recipients} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); router.refresh() }} />
      )}
    </div>
  )
}
