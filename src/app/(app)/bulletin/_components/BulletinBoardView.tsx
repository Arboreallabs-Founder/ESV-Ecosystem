'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createBulletinPost, updateBulletinPost, deleteBulletinPost, toggleBulletinPin,
  toggleBulletinCompleted, toggleEventAttendance, addEventMediaLink, deleteEventMediaLink,
  type BulletinPostInput,
} from '@/app/actions/bulletin'
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
function hostnameOf(url: string) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function PostCard({
  post, past, isAdmin, currentUserId,
  onPin, onEdit, onDelete, onToggleComplete, onToggleGoing, onAddMedia, onDeleteMedia,
}: {
  post: BulletinPost; past: boolean; isAdmin: boolean; currentUserId: string
  onPin: () => void; onEdit: () => void; onDelete: () => void
  onToggleComplete: () => void
  onToggleGoing: () => void
  onAddMedia: (label: string, url: string) => void
  onDeleteMedia: (id: string) => void
}) {
  const [showAddLink, setShowAddLink] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const isEvent = post.post_type === 'event'
  const isGoing = post.attendees.some((a) => a.user_id === currentUserId)

  function submitLink() {
    if (!linkUrl.trim()) return
    onAddMedia(linkLabel, linkUrl)
    setLinkLabel(''); setLinkUrl(''); setShowAddLink(false)
  }

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
            {isEvent && post.completed && <span className={`${styles.badge} ${styles.badgeCompleted}`}>Completed</span>}
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
            {isEvent && (
              <button className={`${styles.iconBtn} ${post.completed ? styles.iconBtnActive : ''}`} onClick={onToggleComplete} title={post.completed ? 'Mark not completed' : 'Mark completed'}>
                {post.completed ? '✓ Completed' : 'Mark complete'}
              </button>
            )}
            <button className={`${styles.iconBtn} ${post.pinned ? styles.iconBtnActive : ''}`} onClick={onPin} title={post.pinned ? 'Unpin' : 'Pin'}>
              {post.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button className={styles.iconBtn} onClick={onEdit} title="Edit">Edit</button>
            <button className={styles.iconBtn} onClick={onDelete} title="Delete">Delete</button>
          </div>
        )}
      </div>
      {post.body && <div className={styles.cardBody}>{post.body}</div>}

      {isEvent && (
        <div className={styles.goingSection}>
          <div className={styles.goingHead}>
            <span className={styles.goingLabel}>
              {post.attendees.length === 0 ? 'No one going yet' : `${post.attendees.length} going`}
            </span>
            <button className={`${styles.goingBtn} ${isGoing ? styles.goingBtnActive : ''}`} onClick={onToggleGoing}>
              {isGoing ? '✓ Going' : "I'm going"}
            </button>
          </div>
          {post.attendees.length > 0 && (
            <div className={styles.attendeeChips}>
              {post.attendees.map((a) => (
                <span key={a.user_id} className={styles.attendeeChip}>{a.user_id === currentUserId ? 'You' : a.name}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {isEvent && (post.media.length > 0 || isAdmin) && (
        <div className={styles.mediaSection}>
          <div className={styles.mediaHead}>
            <span className={styles.mediaLabel}>Supporting media</span>
            {isAdmin && !showAddLink && (
              <button className={styles.mediaAddBtn} onClick={() => setShowAddLink(true)}>+ Add link</button>
            )}
          </div>
          {post.media.length > 0 && (
            <div className={styles.mediaLinks}>
              {post.media.map((m) => (
                <div key={m.id} className={styles.mediaLinkRow}>
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className={styles.mediaLink}>
                    {m.label || hostnameOf(m.url)} ↗
                  </a>
                  {isAdmin && <button className={styles.mediaRemove} onClick={() => onDeleteMedia(m.id)} title="Remove">×</button>}
                </div>
              ))}
            </div>
          )}
          {isAdmin && showAddLink && (
            <div className={styles.mediaAddRow}>
              <input className={styles.mediaAddInput} placeholder="Label (optional)" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
              <input className={styles.mediaAddInput} placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} autoFocus />
              <button className={styles.mediaAddSave} onClick={submitLink}>Add</button>
              <button className={styles.mediaAddCancel} onClick={() => { setShowAddLink(false); setLinkLabel(''); setLinkUrl('') }}>Cancel</button>
            </div>
          )}
        </div>
      )}

      <div className={styles.cardFoot}>Posted {formatPostedDate(post.created_at)}{post.created_by_user?.name ? ` by ${post.created_by_user.name}` : ''}</div>
    </div>
  )
}

export default function BulletinBoardView({ posts: initialPosts, isAdmin, currentUserId }: { posts: BulletinPost[]; isAdmin: boolean; currentUserId: string }) {
  const router = useRouter()
  const [posts, setPosts] = useState(initialPosts)
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

  function mutatePost(id: string, updater: (p: BulletinPost) => BulletinPost) {
    setPosts((prev) => prev.map((p) => p.id === id ? updater(p) : p))
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this post?')) return
    setPosts((prev) => prev.filter((p) => p.id !== id))
    startTransition(async () => { await deleteBulletinPost(id); router.refresh() })
  }
  function handlePin(post: BulletinPost) {
    const next = !post.pinned
    mutatePost(post.id, (p) => ({ ...p, pinned: next }))
    startTransition(async () => { await toggleBulletinPin(post.id, next); router.refresh() })
  }
  function handleToggleComplete(post: BulletinPost) {
    const next = !post.completed
    mutatePost(post.id, (p) => ({ ...p, completed: next }))
    startTransition(async () => { await toggleBulletinCompleted(post.id, next); router.refresh() })
  }
  function handleToggleGoing(post: BulletinPost) {
    const isGoing = post.attendees.some((a) => a.user_id === currentUserId)
    const next = !isGoing
    mutatePost(post.id, (p) => ({
      ...p,
      attendees: next
        ? [...p.attendees, { user_id: currentUserId, name: 'You' }]
        : p.attendees.filter((a) => a.user_id !== currentUserId),
    }))
    startTransition(async () => {
      try { await toggleEventAttendance(post.id, next) }
      catch (err) { alert(String(err)) }
      router.refresh()
    })
  }
  function handleAddMedia(post: BulletinPost, label: string, url: string) {
    startTransition(async () => {
      try {
        const id = await addEventMediaLink(post.id, label || null, url)
        mutatePost(post.id, (p) => ({ ...p, media: [...p.media, { id, post_id: post.id, label: label || null, url, created_at: new Date().toISOString() }] }))
      } catch (err) { alert(String(err)) }
    })
  }
  function handleDeleteMedia(post: BulletinPost, mediaId: string) {
    mutatePost(post.id, (p) => ({ ...p, media: p.media.filter((m) => m.id !== mediaId) }))
    startTransition(async () => { await deleteEventMediaLink(mediaId) })
  }

  const cardProps = (post: BulletinPost, past = false) => ({
    post, past, isAdmin, currentUserId,
    onPin: () => handlePin(post),
    onEdit: () => setEditing(post),
    onDelete: () => handleDelete(post.id),
    onToggleComplete: () => handleToggleComplete(post),
    onToggleGoing: () => handleToggleGoing(post),
    onAddMedia: (label: string, url: string) => handleAddMedia(post, label, url),
    onDeleteMedia: (mediaId: string) => handleDeleteMedia(post, mediaId),
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
