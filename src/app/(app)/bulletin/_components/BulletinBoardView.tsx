'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBulletinPost, updateBulletinPost, deleteBulletinPost, toggleBulletinPin, type BulletinPostInput } from '@/app/actions/bulletin'
import { BULLETIN_POST_TYPES } from '@/lib/types'
import type { BulletinPost, BulletinPostType } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import { WikiButton } from '@/app/_components/WikiPanel'
import styles from '../bulletin.module.css'

function todayStr() { return new Date().toISOString().slice(0, 10) }
function formatEventDate(dateStr: string, timeStr: string | null) {
  const d = new Date(`${dateStr}T00:00:00`)
  const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  return timeStr ? `${label}, ${timeStr.slice(0, 5)}` : label
}
function formatPostedDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function PostCard({ post, past, isAdmin, onPin, onEdit, onDelete }: {
  post: BulletinPost; past: boolean; isAdmin: boolean
  onPin: () => void; onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className={`${styles.card} ${post.pinned ? styles.cardPinned : ''} ${past ? styles.cardPast : ''}`}>
      <div className={styles.cardTop}>
        <div>
          <div className={styles.cardTitleRow}>
            <span className={styles.cardTitle}>{post.title}</span>
            <span className={`${styles.badge} ${post.post_type === 'event' ? styles.badgeEvent : styles.badgeAnnouncement}`}>
              {post.post_type === 'event' ? 'Event' : 'Announcement'}
            </span>
            {post.pinned && <span className={`${styles.badge} ${styles.badgePinned}`}>Pinned</span>}
          </div>
          {(post.event_date || post.location) && (
            <div className={styles.cardMeta}>
              {post.post_type === 'event' && post.event_date && <span>{formatEventDate(post.event_date, post.event_time)}</span>}
              {post.location && <span>{post.location}</span>}
            </div>
          )}
        </div>
        {isAdmin && (
          <div className={styles.cardActions}>
            <button className={`${styles.iconBtn} ${post.pinned ? styles.iconBtnActive : ''}`} onClick={onPin} title={post.pinned ? 'Unpin' : 'Pin'}>
              {post.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button className={styles.iconBtn} onClick={onEdit} title="Edit">Edit</button>
            <button className={styles.iconBtn} onClick={onDelete} title="Delete">Delete</button>
          </div>
        )}
      </div>
      {post.body && <div className={styles.cardBody}>{post.body}</div>}
      <div className={styles.cardFoot}>Posted {formatPostedDate(post.created_at)}{post.created_by_user?.name ? ` by ${post.created_by_user.name}` : ''}</div>
    </div>
  )
}

export default function BulletinBoardView({ posts, isAdmin }: { posts: BulletinPost[]; isAdmin: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<BulletinPost | 'new' | null>(null)
  const [, startTransition] = useTransition()
  const today = todayStr()

  const pinned = posts.filter((p) => p.pinned)
  const upcomingEvents = posts
    .filter((p) => !p.pinned && p.post_type === 'event' && (!p.event_date || p.event_date >= today))
    .sort((a, b) => (a.event_date ?? '9999').localeCompare(b.event_date ?? '9999'))
  const announcements = posts.filter((p) => !p.pinned && p.post_type === 'announcement')
  const pastEvents = posts
    .filter((p) => !p.pinned && p.post_type === 'event' && p.event_date && p.event_date < today)
    .sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''))

  function handleDelete(id: string) {
    if (!confirm('Delete this post?')) return
    startTransition(async () => { await deleteBulletinPost(id); router.refresh() })
  }
  function handlePin(post: BulletinPost) {
    startTransition(async () => { await toggleBulletinPin(post.id, !post.pinned); router.refresh() })
  }

  const cardProps = (post: BulletinPost, past = false) => ({
    post, past, isAdmin,
    onPin: () => handlePin(post),
    onEdit: () => setEditing(post),
    onDelete: () => handleDelete(post.id),
  })

  const hasAnything = posts.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>Bulletin Board</div>
            <WikiButton sectionKey="bulletin" />
          </div>
          <div className={styles.pageSub}>Company-wide events &amp; announcements</div>
        </div>
        {isAdmin && <button className={styles.primaryBtn} onClick={() => setEditing('new')}>+ New post</button>}
      </div>

      <div className={styles.content}>
        {!hasAnything ? (
          <div className={styles.empty}>Nothing posted yet.</div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Pinned</div>
                <div className={styles.list}>{pinned.map((p) => <PostCard key={p.id} {...cardProps(p)} />)}</div>
              </>
            )}

            {upcomingEvents.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Upcoming events</div>
                <div className={styles.list}>{upcomingEvents.map((p) => <PostCard key={p.id} {...cardProps(p)} />)}</div>
              </>
            )}

            {announcements.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Announcements</div>
                <div className={styles.list}>{announcements.map((p) => <PostCard key={p.id} {...cardProps(p)} />)}</div>
              </>
            )}

            {pastEvents.length > 0 && (
              <details className={styles.doneGroup}>
                <summary className={styles.doneSummary}>Past events ({pastEvents.length})</summary>
                <div className={styles.list}>{pastEvents.map((p) => <PostCard key={p.id} {...cardProps(p, true)} />)}</div>
              </details>
            )}
          </>
        )}
      </div>

      {editing && (
        <BulletinPostModal
          post={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function BulletinPostModal({ post, onClose, onSaved }: { post: BulletinPost | null; onClose: () => void; onSaved: () => void }) {
  const [postType, setPostType] = useState<BulletinPostType>(post?.post_type ?? 'announcement')
  const [title, setTitle] = useState(post?.title ?? '')
  const [body, setBody] = useState(post?.body ?? '')
  const [eventDate, setEventDate] = useState(post?.event_date ?? '')
  const [eventTime, setEventTime] = useState(post?.event_time?.slice(0, 5) ?? '')
  const [location, setLocation] = useState(post?.location ?? '')
  const [pinned, setPinned] = useState(post?.pinned ?? false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    if (postType === 'event' && !eventDate) { setError('Event date is required.'); return }
    const input: BulletinPostInput = {
      post_type: postType, title, body: body || null,
      event_date: eventDate || null, event_time: eventTime || null, location: location || null,
      pinned,
    }
    startTransition(async () => {
      try {
        if (post) await updateBulletinPost(post.id, input)
        else await createBulletinPost(input)
        onSaved()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>{post ? 'Edit post' : 'New post'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.typeToggle}>
            {BULLETIN_POST_TYPES.map((t) => (
              <button key={t} className={`${styles.typeBtn} ${postType === t ? styles.typeBtnActive : ''}`} onClick={() => setPostType(t)}>
                {t === 'event' ? 'Event' : 'Announcement'}
              </button>
            ))}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Title *</label>
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Details</label>
            <textarea className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Optional details…" />
          </div>

          {postType === 'event' && (
            <>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Date *</label>
                  <input className={styles.input} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Time</label>
                  <input className={styles.input} type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Location</label>
                <input className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office, Zoom link, etc." />
              </div>
            </>
          )}

          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Pin to the top
          </label>

          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : post ? 'Save' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
