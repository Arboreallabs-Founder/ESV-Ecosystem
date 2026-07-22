'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBulletinPost, updateBulletinPost, deleteBulletinPost, toggleBulletinPin, type BulletinPostInput } from '@/app/actions/bulletin'
import type { BulletinPost } from '@/lib/types'
import Spinner from '@/app/_components/Spinner'
import { WikiButton } from '@/app/_components/WikiPanel'
import styles from '../bulletin.module.css'

function formatPostedDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function PostCard({
  post, isAdmin, onPin, onEdit, onDelete,
}: {
  post: BulletinPost; isAdmin: boolean
  onPin: () => void; onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className={`${styles.card} ${post.pinned ? styles.cardPinned : ''}`}>
      <div className={styles.cardTop}>
        <div>
          <div className={styles.cardTitleRow}>
            <span className={styles.cardTitle}>{post.title}</span>
            {post.pinned && <span className={`${styles.badge} ${styles.badgePinned}`}>Pinned</span>}
          </div>
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

export default function BulletinBoardView({ posts: initialPosts, isAdmin }: { posts: BulletinPost[]; isAdmin: boolean }) {
  const router = useRouter()
  const [posts, setPosts] = useState(initialPosts)
  const [editing, setEditing] = useState<BulletinPost | 'new' | null>(null)
  const [, startTransition] = useTransition()

  const pinned = posts.filter((p) => p.pinned)
  const others = posts.filter((p) => !p.pinned)

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

  const cardProps = (post: BulletinPost) => ({
    post, isAdmin,
    onPin: () => handlePin(post),
    onEdit: () => setEditing(post),
    onDelete: () => handleDelete(post.id),
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={styles.pageTitle}>Bulletin Board</div>
            <WikiButton sectionKey="bulletin" />
          </div>
          <div className={styles.pageSub}>Company-wide announcements</div>
        </div>
        {isAdmin && <button className={styles.primaryBtn} onClick={() => setEditing('new')}>+ New post</button>}
      </div>

      <div className={styles.content}>
        {posts.length === 0 ? (
          <div className={styles.empty}>Nothing posted yet.</div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Pinned</div>
                <div className={styles.list}>{pinned.map((p) => <PostCard key={p.id} {...cardProps(p)} />)}</div>
              </>
            )}
            {others.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Announcements</div>
                <div className={styles.list}>{others.map((p) => <PostCard key={p.id} {...cardProps(p)} />)}</div>
              </>
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
  const [title, setTitle] = useState(post?.title ?? '')
  const [body, setBody] = useState(post?.body ?? '')
  const [pinned, setPinned] = useState(post?.pinned ?? false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    const input: BulletinPostInput = { title, body: body || null, pinned }
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
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Title *</label>
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Details</label>
            <textarea className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Optional details…" />
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
            {pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Saving…</span> : post ? 'Save' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
