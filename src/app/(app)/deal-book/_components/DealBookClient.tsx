'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { describeError } from '@/lib/client-errors'
import { setDealBookDesign, setDealBookOrder } from '@/app/actions/deal-book'
import type { DealBookRow, DealBookSettings, DesignSlot } from '@/lib/deal-book'
import { uploadDealBookPdf, viewDealBookPdf } from './upload'
import styles from '../deal-book.module.css'

const SLOTS: Array<{ slot: DesignSlot; label: string; hint: string }> = [
  { slot: 'cover', label: '1. Cover', hint: 'Today’s date is stamped on it.' },
  { slot: 'about', label: '2. About Us', hint: 'Used exactly as uploaded.' },
  { slot: 'contents', label: '3. Contents', hint: 'The deal list and page numbers are stamped on it.' },
  { slot: 'back', label: '5. Back page', hint: 'Used exactly as uploaded.' },
]

export default function DealBookClient({ rows, settings, canManage, orgId }: {
  rows: DealBookRow[]
  settings: DealBookSettings | null
  canManage: boolean
  orgId: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [busySlot, setBusySlot] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  // The order as last saved, overridden by `draft` while a reorder is saving so the list moves at once.
  const [draft, setDraft] = useState<string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)

  const byId = new Map(rows.map((r) => [r.active_deal_id, r]))
  const savedIds = rows.filter((r) => r.position !== null).map((r) => r.active_deal_id)
  const ids = (draft ?? savedIds).filter((id) => byId.has(id))
  const inBook = ids.map((id) => byId.get(id)!)
  const outOfBook = rows.filter((r) => !ids.includes(r.active_deal_id))

  function run(fn: () => Promise<unknown>) {
    setError(null)
    start(async () => {
      try { await fn(); router.refresh() } catch (e) { setError(describeError(e).message) }
    })
  }

  function order(next: string[]) {
    setError(null)
    setDraft(next)
    start(async () => {
      try { await setDealBookOrder(next); router.refresh() } catch (e) { setError(describeError(e).message) }
      finally { setDraft(null) }
    })
  }
  /** Move the deal at `from` so it ends up at index `to`. */
  function moveTo(from: number, to: number) {
    if (from === to || to < 0 || to >= ids.length) return
    const next = [...ids]
    const [id] = next.splice(from, 1)
    next.splice(to, 0, id)
    order(next)
  }
  function dropOn(slot: number) {
    // `slot` is the gap before row `slot`; dropping below yourself shifts the target up by one.
    const from = dragId ? ids.indexOf(dragId) : -1
    setDragId(null)
    setDropAt(null)
    if (from < 0) return
    moveTo(from, slot > from ? slot - 1 : slot)
  }

  async function uploadDesign(slot: DesignSlot, file: File) {
    setError(null)
    setBusySlot(slot)
    try {
      const path = await uploadDealBookPdf(orgId, `designs/${slot}`, file)
      await setDealBookDesign(slot, path)
      router.refresh()
    } catch (e) { setError(describeError(e).message) } finally { setBusySlot(null) }
  }

  async function download(version: 'named' | 'noname') {
    setError(null)
    setDownloading(version)
    try {
      const res = await fetch(`/api/deal-book?version=${version}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? 'The Deal Book could not be built.')
      }
      const blob = await res.blob()
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'ESV Deal Book.pdf'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(describeError(e).message) } finally { setDownloading(null) }
  }

  /** Opens the book as it would download now, in a new tab. */
  function preview(version: 'named' | 'noname') {
    window.open(`/api/deal-book?version=${version}&preview=1`, '_blank', 'noopener')
  }

  const namedReady = inBook.filter((r) => r.im?.named_path).length
  const nonameReady = inBook.filter((r) => r.im?.noname_path).length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Deal Book</div>
          <div className={styles.pageSub}>
            All our deal IMs in one PDF: cover, About Us, contents, each IM, back page, with page numbers
            stamped on. Built fresh on every download.
          </div>
        </div>
        <div className={styles.downloads}>
          <button className={styles.ghostBtn} onClick={() => preview('named')}>Preview</button>
          <button className={styles.primaryBtn} disabled={!!downloading || namedReady === 0} onClick={() => download('named')}>
            {downloading === 'named' ? 'Building…' : `Download (${namedReady} deal${namedReady === 1 ? '' : 's'})`}
          </button>
          <button className={styles.ghostBtn} disabled={!!downloading || nonameReady === 0} onClick={() => download('noname')}>
            {downloading === 'noname' ? 'Building…' : `Download no-name (${nonameReady})`}
          </button>
        </div>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      {canManage && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>Page designs</div>
            <div className={styles.panelHint}>
              The ESV IM Book template is used for each page. Upload a PDF only to replace one; keep the same layout so the date and deal list land in the right place.{' '}
              <button className={styles.inlineLinkBtn} onClick={() => preview('named')}>Preview the whole book</button>
              {nonameReady > 0 && <>{' · '}<button className={styles.inlineLinkBtn} onClick={() => preview('noname')}>no-name version</button></>}
            </div>
          </div>
          <div className={styles.designGrid}>
            {SLOTS.map(({ slot, label, hint }) => {
              const path = settings?.[`${slot}_path`] ?? null
              return (
                <div key={slot} className={styles.designCard}>
                  <div className={styles.designLabel}>{label}</div>
                  <div className={styles.designHint}>{hint}</div>
                  <div className={path ? styles.designSet : styles.designUnset}>{path ? 'Custom design' : 'ESV template'}</div>
                  <div className={styles.designActions}>
                    <label className={styles.ghostBtnSm}>
                      {busySlot === slot ? 'Uploading…' : path ? 'Replace' : 'Upload PDF'}
                      <input type="file" accept="application/pdf" hidden disabled={!!busySlot}
                             onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadDesign(slot, f) }} />
                    </label>
                    <button
                      className={styles.linkBtn}
                      onClick={() => (path ? viewDealBookPdf(path) : window.open(`/api/deal-book/template?slot=${slot}`, '_blank', 'noopener'))}
                    >
                      View
                    </button>
                    {path && <button className={styles.linkBtn} disabled={pending} onClick={() => run(() => setDealBookDesign(slot, null))}>Remove</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div className={styles.panelTitle}>4. Deals in the book <span className={styles.count}>{inBook.length}</span></div>
          <div className={styles.panelHint}>
            Drag deals into the order you want, or pick a position number. Only deals marked Active appear here. Upload each deal’s IM on its Active Deal page. The no-name download uses each deal’s no-name IM and codename.{' '}
            <a href="/templates/no-name-im-template.html" download className={styles.inlineLink}>Download the blank no-name IM template</a>
          </div>
        </div>
        {inBook.length === 0 ? (
          <div className={styles.empty}>No deals in the book yet.{canManage ? ' Add them from the list below.' : ''}</div>
        ) : (
          <ol className={styles.list} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropAt(null) }}>
            {inBook.map((r, i) => (
              <li
                key={r.active_deal_id}
                className={[
                  styles.row,
                  canManage ? styles.draggable : '',
                  dragId === r.active_deal_id ? styles.dragging : '',
                  dropAt === i ? styles.dropBefore : '',
                  dropAt === i + 1 && i === inBook.length - 1 ? styles.dropAfter : '',
                ].join(' ')}
                draggable={canManage && !pending}
                onDragStart={(e) => { setDragId(r.active_deal_id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.active_deal_id) }}
                onDragEnd={() => { setDragId(null); setDropAt(null) }}
                onDragOver={(e) => {
                  if (!dragId) return
                  e.preventDefault()
                  const box = e.currentTarget.getBoundingClientRect()
                  setDropAt(e.clientY < box.top + box.height / 2 ? i : i + 1)
                }}
                onDrop={(e) => { e.preventDefault(); if (dropAt !== null) dropOn(dropAt) }}
              >
                {canManage && <span className={styles.handle} aria-hidden="true">⠿</span>}
                {canManage ? (
                  <select
                    className={styles.posSelect}
                    value={i}
                    disabled={pending}
                    aria-label={`Position of ${r.title}`}
                    onChange={(e) => moveTo(i, Number(e.target.value))}
                  >
                    {inBook.map((_, j) => <option key={j} value={j}>{j + 1}</option>)}
                  </select>
                ) : (
                  <span className={styles.rowNum}>{i + 1}</span>
                )}
                <div className={styles.rowMain}>
                  <Link href={`/active-deals/${r.active_deal_id}`} className={styles.rowTitle}>{r.title}</Link>
                  <div className={styles.rowMeta}>
                    <span className={r.im?.named_path ? styles.ok : styles.missing}>{r.im?.named_path ? 'IM' : 'No IM'}</span>
                    <span className={r.im?.noname_path ? styles.ok : styles.missing}>{r.im?.noname_path ? 'No-name IM' : 'No no-name IM'}</span>
                    {r.im?.codename && <span className={styles.codename}>{r.im.codename}</span>}
                  </div>
                </div>
                {canManage && (
                  <div className={styles.rowActions}>
                    <button className={styles.iconBtn} disabled={pending || i === 0} onClick={() => moveTo(i, i - 1)} aria-label="Move up">↑</button>
                    <button className={styles.iconBtn} disabled={pending || i === inBook.length - 1} onClick={() => moveTo(i, i + 1)} aria-label="Move down">↓</button>
                    <button className={styles.linkBtn} disabled={pending} onClick={() => order(ids.filter((x) => x !== r.active_deal_id))}>Remove</button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {canManage && outOfBook.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>Other deals <span className={styles.count}>{outOfBook.length}</span></div>
          </div>
          <ul className={styles.list}>
            {outOfBook.map((r) => (
              <li key={r.active_deal_id} className={styles.row}>
                <div className={styles.rowMain}>
                  <Link href={`/active-deals/${r.active_deal_id}`} className={styles.rowTitle}>{r.title}</Link>
                  <div className={styles.rowMeta}>
                    <span className={r.im?.named_path ? styles.ok : styles.missing}>{r.im?.named_path ? 'IM uploaded' : 'No IM yet'}</span>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <button className={styles.ghostBtnSm} disabled={pending} onClick={() => order([...ids, r.active_deal_id])}>+ Add to book</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
