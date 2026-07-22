'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createEvent, updateEvent, deleteEvent, toggleEventPin, toggleEventCompleted,
  toggleEventAttendance, addEventAttendee, removeEventAttendee, addEventMediaLink, deleteEventMediaLink,
  type EventInput,
} from '@/app/actions/events'
import type { BulletinPost } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import { WikiButton } from '@/app/_components/WikiPanel'
import styles from '../events.module.css'

function formatEventDate(dateStr: string, timeStr: string | null) {
  const d = new Date(`${dateStr}T00:00:00`)
  const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  return timeStr ? `${label}, ${timeStr.slice(0, 5)}` : label
}
function formatPostedDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
function hostnameOf(url: string) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function AttendeeAdd({ options, onAdd }: { options: Array<{ id: string; name: string }>; onAdd: (userId: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const q = query.trim().toLowerCase()
  const filtered = (q ? options.filter((u) => u.name.toLowerCase().includes(q)) : options).slice(0, 8)

  function select(u: { id: string; name: string }) {
    onAdd(u.id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className={styles.attendeeAddWrap}>
      <input
        ref={inputRef}
        type="text"
        className={styles.attendeeAddInput}
        placeholder="+ Add attendee…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className={styles.attendeeAddDropdown} onMouseDown={(e) => e.preventDefault()}>
          {filtered.length === 0 ? (
            <div className={styles.attendeeAddEmpty}>No matches</div>
          ) : (
            filtered.map((u) => (
              <button key={u.id} type="button" className={styles.attendeeAddItem} onClick={() => select(u)}>{u.name}</button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function EventCard({
  event, past, isAdmin, currentUserId, internalUsers,
  onPin, onEdit, onDelete, onToggleComplete, onToggleGoing, onAddAttendee, onRemoveAttendee, onAddMedia, onDeleteMedia,
}: {
  event: BulletinPost; past: boolean; isAdmin: boolean; currentUserId: string
  internalUsers: Array<{ id: string; name: string }>
  onPin: () => void; onEdit: () => void; onDelete: () => void
  onToggleComplete: () => void
  onToggleGoing: () => void
  onAddAttendee: (userId: string) => void
  onRemoveAttendee: (userId: string) => void
  onAddMedia: (label: string, url: string) => void
  onDeleteMedia: (id: string) => void
}) {
  const [showAddLink, setShowAddLink] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const isGoing = event.attendees.some((a) => a.user_id === currentUserId)

  function submitLink() {
    if (!linkUrl.trim()) return
    onAddMedia(linkLabel, linkUrl)
    setLinkLabel(''); setLinkUrl(''); setShowAddLink(false)
  }

  return (
    <div className={`${styles.card} ${event.pinned ? styles.cardPinned : ''} ${past ? styles.cardPast : ''}`}>
      <div className={styles.cardTop}>
        <div>
          <div className={styles.cardTitleRow}>
            <span className={styles.cardTitle}>{event.title}</span>
            {event.pinned && <span className={`${styles.badge} ${styles.badgePinned}`}>Pinned</span>}
            {event.completed && <span className={`${styles.badge} ${styles.badgeCompleted}`}>Completed</span>}
          </div>
          {(event.event_date || event.location) && (
            <div className={styles.cardMeta}>
              {event.event_date && <span>{formatEventDate(event.event_date, event.event_time)}</span>}
              {event.location && <span>{event.location}</span>}
            </div>
          )}
        </div>
        {isAdmin && (
          <div className={styles.cardActions}>
            <button className={`${styles.iconBtn} ${event.completed ? styles.iconBtnActive : ''}`} onClick={onToggleComplete} title={event.completed ? 'Mark not completed' : 'Mark completed'}>
              {event.completed ? '✓ Completed' : 'Mark complete'}
            </button>
            <button className={`${styles.iconBtn} ${event.pinned ? styles.iconBtnActive : ''}`} onClick={onPin} title={event.pinned ? 'Unpin' : 'Pin'}>
              {event.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button className={styles.iconBtn} onClick={onEdit} title="Edit">Edit</button>
            <button className={styles.iconBtn} onClick={onDelete} title="Delete">Delete</button>
          </div>
        )}
      </div>
      {event.body && <div className={styles.cardBody}>{event.body}</div>}

      <div className={styles.goingSection}>
        <div className={styles.goingHead}>
          <span className={styles.goingLabel}>
            {event.attendees.length === 0 ? 'No one going yet' : `${event.attendees.length} ${past ? 'attended' : 'going'}`}
          </span>
          <button className={`${styles.goingBtn} ${isGoing ? styles.goingBtnActive : ''}`} onClick={onToggleGoing}>
            {isGoing ? '✓ Going' : "I'm going"}
          </button>
        </div>
        {event.attendees.length > 0 && (
          <div className={styles.attendeeChips}>
            {event.attendees.map((a) => (
              <span key={a.user_id} className={styles.attendeeChip}>
                {a.user_id === currentUserId ? 'You' : a.name}
                {isAdmin && a.user_id !== currentUserId && (
                  <button
                    type="button"
                    className={styles.attendeeChipRemove}
                    onMouseDown={(e) => { e.preventDefault(); onRemoveAttendee(a.user_id) }}
                    aria-label={`Remove ${a.name}`}
                  >×</button>
                )}
              </span>
            ))}
          </div>
        )}
        {isAdmin && (
          <AttendeeAdd
            options={internalUsers.filter((u) => !event.attendees.some((a) => a.user_id === u.id))}
            onAdd={onAddAttendee}
          />
        )}
      </div>

      {(event.media_url || event.scanned_cards_url) && (
        <div className={styles.linksSection}>
          {event.media_url && (
            <div className={styles.linkRow}>
              <span className={styles.linkRowLabel}>Event media:</span>
              <a href={event.media_url} target="_blank" rel="noopener noreferrer" className={styles.linkRowValue}>{event.media_url} ↗</a>
            </div>
          )}
          {event.scanned_cards_url && (
            <div className={styles.linkRow}>
              <span className={styles.linkRowLabel}>Scanned cards:</span>
              <a href={event.scanned_cards_url} target="_blank" rel="noopener noreferrer" className={styles.linkRowValue}>{event.scanned_cards_url} ↗</a>
            </div>
          )}
        </div>
      )}

      {(event.media.length > 0 || isAdmin) && (
        <div className={styles.mediaSection}>
          <div className={styles.mediaHead}>
            <span className={styles.mediaLabel}>Other links</span>
            {isAdmin && !showAddLink && (
              <button className={styles.mediaAddBtn} onClick={() => setShowAddLink(true)}>+ Add link</button>
            )}
          </div>
          {event.media.length > 0 && (
            <div className={styles.mediaLinks}>
              {event.media.map((m) => (
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

      <div className={styles.cardFoot}>Posted {formatPostedDate(event.created_at)}{event.created_by_user?.name ? ` by ${event.created_by_user.name}` : ''}</div>
    </div>
  )
}

export default function EventsView({
  events: initialEvents, isAdmin, currentUserId, mode, internalUsers,
}: {
  events: BulletinPost[]; isAdmin: boolean; currentUserId: string; mode: 'upcoming' | 'past'
  internalUsers: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [events, setEvents] = useState(initialEvents)
  const [editing, setEditing] = useState<BulletinPost | 'new' | null>(null)
  const [, startTransition] = useTransition()
  const past = mode === 'past'

  function mutateEvent(id: string, updater: (e: BulletinPost) => BulletinPost) {
    setEvents((prev) => prev.map((e) => e.id === id ? updater(e) : e))
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return
    setEvents((prev) => prev.filter((e) => e.id !== id))
    startTransition(async () => { await deleteEvent(id); router.refresh() })
  }
  function handlePin(event: BulletinPost) {
    const next = !event.pinned
    mutateEvent(event.id, (e) => ({ ...e, pinned: next }))
    startTransition(async () => { await toggleEventPin(event.id, next); router.refresh() })
  }
  function handleToggleComplete(event: BulletinPost) {
    const next = !event.completed
    mutateEvent(event.id, (e) => ({ ...e, completed: next }))
    startTransition(async () => { await toggleEventCompleted(event.id, next); router.refresh() })
  }
  function handleToggleGoing(event: BulletinPost) {
    const isGoing = event.attendees.some((a) => a.user_id === currentUserId)
    const next = !isGoing
    mutateEvent(event.id, (e) => ({
      ...e,
      attendees: next
        ? [...e.attendees, { user_id: currentUserId, name: 'You' }]
        : e.attendees.filter((a) => a.user_id !== currentUserId),
    }))
    startTransition(async () => {
      try { await toggleEventAttendance(event.id, next) }
      catch (err) { alert(String(err)) }
      router.refresh()
    })
  }
  function handleAddMedia(event: BulletinPost, label: string, url: string) {
    startTransition(async () => {
      try {
        const id = await addEventMediaLink(event.id, label || null, url)
        mutateEvent(event.id, (e) => ({ ...e, media: [...e.media, { id, post_id: event.id, label: label || null, url, created_at: new Date().toISOString() }] }))
      } catch (err) { alert(String(err)) }
    })
  }
  function handleDeleteMedia(event: BulletinPost, mediaId: string) {
    mutateEvent(event.id, (e) => ({ ...e, media: e.media.filter((m) => m.id !== mediaId) }))
    startTransition(async () => { await deleteEventMediaLink(mediaId) })
  }
  function handleAddAttendee(event: BulletinPost, userId: string) {
    startTransition(async () => {
      try {
        const attendee = await addEventAttendee(event.id, userId)
        mutateEvent(event.id, (e) => ({ ...e, attendees: [...e.attendees, attendee] }))
      } catch (err) { alert(String(err)) }
    })
  }
  function handleRemoveAttendee(event: BulletinPost, userId: string) {
    mutateEvent(event.id, (e) => ({ ...e, attendees: e.attendees.filter((a) => a.user_id !== userId) }))
    startTransition(async () => { await removeEventAttendee(event.id, userId) })
  }

  const cardProps = (event: BulletinPost) => ({
    event, past, isAdmin, currentUserId, internalUsers,
    onPin: () => handlePin(event),
    onEdit: () => setEditing(event),
    onDelete: () => handleDelete(event.id),
    onToggleComplete: () => handleToggleComplete(event),
    onToggleGoing: () => handleToggleGoing(event),
    onAddAttendee: (userId: string) => handleAddAttendee(event, userId),
    onRemoveAttendee: (userId: string) => handleRemoveAttendee(event, userId),
    onAddMedia: (label: string, url: string) => handleAddMedia(event, label, url),
    onDeleteMedia: (mediaId: string) => handleDeleteMedia(event, mediaId),
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>{past ? 'Past Events' : 'Upcoming Events'}</div>
            <WikiButton sectionKey="bulletin" />
          </div>
          <div className={styles.pageSub}>{past ? 'Events that have already happened.' : 'What\'s coming up next.'}</div>
        </div>
        {isAdmin && (
          <button className={styles.primaryBtn} onClick={() => setEditing('new')}>+ New Event</button>
        )}
      </div>

      <div className={styles.content}>
        {events.length === 0 ? (
          <div className={styles.empty}>{past ? 'No past events yet.' : 'No upcoming events. Create one to get started.'}</div>
        ) : (
          <div className={styles.list}>{events.map((e) => <EventCard key={e.id} {...cardProps(e)} />)}</div>
        )}
      </div>

      {editing && (
        <EventModal
          event={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function EventModal({ event, onClose, onSaved }: { event: BulletinPost | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [body, setBody] = useState(event?.body ?? '')
  const [eventDate, setEventDate] = useState(event?.event_date ?? '')
  const [eventTime, setEventTime] = useState(event?.event_time?.slice(0, 5) ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [mediaUrl, setMediaUrl] = useState(event?.media_url ?? '')
  const [scannedCardsUrl, setScannedCardsUrl] = useState(event?.scanned_cards_url ?? '')
  const [pinned, setPinned] = useState(event?.pinned ?? false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    if (!eventDate) { setError('Event date is required.'); return }
    const input: EventInput = {
      title, body: body || null,
      event_date: eventDate, event_time: eventTime || null, location: location || null,
      media_url: mediaUrl || null, scanned_cards_url: scannedCardsUrl || null,
      pinned,
    }
    startTransition(async () => {
      try {
        if (event) await updateEvent(event.id, input)
        else await createEvent(input)
        onSaved()
      } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>{event ? 'Edit event' : 'New event'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Title *</label>
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Details</label>
            <textarea className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Optional details…" />
          </div>

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

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Event media (Google link)</label>
            <input className={styles.input} value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://photos.google.com/…" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Scanned cards (Drive link)</label>
            <input className={styles.input} value={scannedCardsUrl} onChange={(e) => setScannedCardsUrl(e.target.value)} placeholder="https://drive.google.com/…" />
          </div>

          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Pin to the top
          </label>

          {error && <div className={styles.errBox}>{error}</div>}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
          <button className={styles.primaryBtn} onClick={submit} disabled={pending}>
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : event ? 'Save' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
