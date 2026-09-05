'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { parsePolicy, policyOutline, type PolicyBlock, type PolicyListItem, type PolicySpan } from '@/lib/policy-doc'
import type { HrPolicy } from '@/lib/types'
import Avatar from '@/app/_components/Avatar'
import styles from '../policy.module.css'

function Spans({ spans }: { spans: PolicySpan[] }) {
  return <>{spans.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}</>
}

function Items({ items, ordered }: { items: PolicyListItem[]; ordered: boolean }) {
  const List = ordered ? 'ol' : 'ul'
  return (
    <List className={ordered ? styles.ol : styles.ul}>
      {items.map((item, i) => (
        <li key={i} className={styles.li}>
          <Spans spans={item.spans} />
          {item.sub && <Items items={item.sub.items} ordered={item.sub.ordered} />}
        </li>
      ))}
    </List>
  )
}

function Block({ block }: { block: PolicyBlock }) {
  switch (block.kind) {
    case 'heading': {
      const Tag = (`h${block.level}`) as 'h2' | 'h3' | 'h4'
      const cls = block.level === 2 ? styles.h2 : block.level === 3 ? styles.h3 : styles.h4
      return <Tag id={`pol-${block.id}`} className={cls} data-policy-heading={block.id}>{block.text}</Tag>
    }
    case 'para':
      return <p className={styles.p}><Spans spans={block.spans} /></p>
    case 'callout':
      return <aside className={styles.callout}><Spans spans={block.spans} /></aside>
    case 'list':
      return <Items items={block.items} ordered={block.ordered} />
    case 'table':
      // Wide content scrolls inside its own box — the reader itself must never scroll sideways.
      return (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            {block.head.length > 0 && (
              <thead><tr>{block.head.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
            )}
            <tbody>
              {block.rows.map((row, r) => <tr key={r}>{row.map((c, i) => <td key={i}>{c}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      )
  }
}

export function PolicyDocument({ body }: { body: string }) {
  const blocks = useMemo(() => parsePolicy(body), [body])
  return <>{blocks.map((b, i) => <Block key={i} block={b} />)}</>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PolicyReader({ policy, canEdit, onEdit, onClose }: {
  policy: HrPolicy; canEdit: boolean; onEdit: () => void; onClose: () => void
}) {
  const blocks = useMemo(() => parsePolicy(policy.body), [policy.body])
  const outline = useMemo(() => policyOutline(blocks), [blocks])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState<string | null>(outline[0]?.id ?? null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Which section am I in, and how far through. Both read off the reader's own scroller rather
  // than the window — the page behind is still there and still scrolled where it was.
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const headings = Array.from(scroller.querySelectorAll<HTMLElement>('[data-policy-heading]'))

    function update() {
      if (!scroller) return
      const reach = scroller.scrollHeight - scroller.clientHeight
      setProgress(reach > 0 ? Math.min(1, scroller.scrollTop / reach) : 1)
      // The last heading whose top has passed the reading line, so the rail marks the section
      // being read rather than the one about to arrive.
      const line = scroller.getBoundingClientRect().top + 120
      let current: string | null = headings[0]?.dataset.policyHeading ?? null
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= line) current = h.dataset.policyHeading ?? current
        else break
      }
      setActiveId(current)
    }

    update()
    scroller.addEventListener('scroll', update, { passive: true })
    return () => scroller.removeEventListener('scroll', update)
  }, [blocks])

  function jumpTo(id: string) {
    scrollRef.current?.querySelector(`#pol-${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.reader} role="dialog" aria-modal="true" aria-label={policy.title}>
        <div className={styles.progressTrack}>
          <div className={styles.progressBar} style={{ transform: `scaleX(${progress})` }} />
        </div>

        <header className={styles.readerHead}>
          <div className={styles.readerHeadText}>
            <div className={styles.readerEyebrow}>
              {policy.category && <span className={styles.readerChip}>{policy.category}</span>}
              <span>Updated {formatDate(policy.updated_at)}</span>
              {policy.created_by_user?.name && (
                <span className={styles.readerAuthor}>
                  <Avatar name={policy.created_by_user.name} photoUrl={policy.created_by_user.photo_url} size="xs" />
                  {policy.created_by_user.name}
                </span>
              )}
            </div>
            <h2 className={styles.readerTitle}>{policy.title}</h2>
          </div>
          <div className={styles.readerActions}>
            {canEdit && <button className={styles.ghostBtn} onClick={onEdit}>Edit</button>}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>

        <div className={styles.readerScroll} ref={scrollRef}>
          <div className={styles.readerGrid}>
            {outline.length > 1 && (
              <nav className={styles.toc} aria-label="Contents">
                <div className={styles.tocLabel}>Contents</div>
                {outline.map((entry) => (
                  <button
                    key={entry.id}
                    className={`${styles.tocLink} ${entry.level === 3 ? styles.tocLinkSub : ''} ${activeId === entry.id ? styles.tocLinkActive : ''}`}
                    onClick={() => jumpTo(entry.id)}
                  >
                    {entry.text}
                  </button>
                ))}
              </nav>
            )}
            <article className={styles.doc}>
              {blocks.map((b, i) => <Block key={i} block={b} />)}
            </article>
          </div>
        </div>
      </div>
    </div>
  )
}
