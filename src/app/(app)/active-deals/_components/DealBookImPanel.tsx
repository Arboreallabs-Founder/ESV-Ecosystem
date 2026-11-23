'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { describeError } from '@/lib/client-errors'
import { saveDealIm, setDealInBook } from '@/app/actions/deal-book'
import type { DealBookIm } from '@/lib/deal-book'
import { uploadDealBookPdf, viewDealBookPdf } from '@/app/(app)/deal-book/_components/upload'
import styles from '../active-deals.module.css'

/**
 * This deal in the Active Deal Book (20261124000000): whether it shows in the book, the IM, the
 * no-name IM made from the blank template, and the codename the no-name book uses. Founders and
 * admins change these; everyone else sees what's there.
 */
export default function DealBookImPanel({ dealId, orgId, im, inBook, isActive, canManage }: {
  dealId: string
  orgId: string
  im: DealBookIm | null
  inBook: boolean
  /** Only deals marked Active appear in the book, whatever the toggle says. */
  isActive: boolean
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [codename, setCodename] = useState(im?.codename ?? '')
  // Optimistic: the switch moves at once and snaps back if the save fails.
  const [shown, setShown] = useState(inBook)

  async function toggleShown() {
    const next = !shown
    setError(null)
    setShown(next)
    setBusy('toggle')
    try { await setDealInBook(dealId, next); router.refresh() }
    catch (e) { setShown(!next); setError(describeError(e).message) }
    finally { setBusy(null) }
  }

  async function upload(kind: 'named' | 'noname', file: File) {
    setError(null)
    setBusy(kind)
    try {
      const path = await uploadDealBookPdf(orgId, `ims/${dealId}`, file)
      await saveDealIm(dealId, kind === 'named' ? { named_path: path } : { noname_path: path })
      router.refresh()
    } catch (e) { setError(describeError(e).message) } finally { setBusy(null) }
  }

  async function save(patch: Parameters<typeof saveDealIm>[1]) {
    setError(null)
    setBusy('save')
    try { await saveDealIm(dealId, patch); router.refresh() } catch (e) { setError(describeError(e).message) } finally { setBusy(null) }
  }

  const slot = (kind: 'named' | 'noname', label: string, path: string | null | undefined) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.4rem 0' }}>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, minWidth: '7.5rem' }}>{label}</span>
      <span style={{ fontSize: '0.75rem', color: path ? 'var(--color-success)' : 'var(--color-muted)', fontWeight: 600 }}>
        {path ? 'Uploaded' : 'Not uploaded'}
      </span>
      {path && <button className={styles.ghostBtn} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => viewDealBookPdf(path)}>View</button>}
      {canManage && (
        <label className={styles.ghostBtn} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center' }}>
          {busy === kind ? 'Uploading…' : path ? 'Replace' : 'Upload PDF'}
          <input type="file" accept="application/pdf" hidden disabled={!!busy}
                 onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(kind, f) }} />
        </label>
      )}
      {canManage && path && (
        <button className={styles.ghostBtn} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} disabled={!!busy}
                onClick={() => save(kind === 'named' ? { named_path: null } : { noname_path: null })}>Remove</button>
      )}
    </div>
  )

  if (!canManage && !inBook && !im?.named_path && !im?.noname_path) return null

  const status = !shown ? 'Hidden from the book'
    : !isActive ? 'Switched on, but hidden until the deal is marked Active'
    : !im?.named_path ? 'Shown, once an IM is uploaded'
    : 'Shown in the book'

  return (
    <div className={styles.card} style={{ padding: '1rem 1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Active Deal Book</div>
        <Link href="/deal-book" style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>Open the Active Deal Book →</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0 0.35rem', flexWrap: 'wrap' }}>
        {canManage ? (
          <button
            type="button"
            role="switch"
            aria-checked={shown}
            aria-label="Show this deal in the Active Deal Book"
            disabled={busy === 'toggle'}
            onClick={toggleShown}
            data-no-press
            style={{
              position: 'relative', width: '2.4rem', height: '1.35rem', borderRadius: 999, border: 'none', padding: 0, flexShrink: 0,
              cursor: 'pointer', background: shown ? 'var(--color-primary)' : 'var(--color-border)',
              transition: 'background-color var(--dur-fast) var(--ease-out)',
            }}
          >
            <span style={{
              position: 'absolute', top: '0.15rem', left: '0.15rem', width: '1.05rem', height: '1.05rem', borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              transform: shown ? 'translateX(1.05rem)' : 'translateX(0)', transition: 'transform var(--dur-fast) var(--ease-out)',
            }} />
          </button>
        ) : null}
        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Show in the book</span>
        <span style={{ fontSize: '0.75rem', color: shown && isActive && im?.named_path ? 'var(--color-success)' : 'var(--color-muted)', fontWeight: 600 }}>
          {status}
        </span>
      </div>
      {slot('named', 'IM', im?.named_path)}
      {slot('noname', 'No-name IM', im?.noname_path)}
      {canManage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.4rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, minWidth: '7.5rem' }}>Codename</span>
          <input className={styles.formInput} style={{ width: 'auto', flex: 1, minWidth: '10rem' }} value={codename}
                 placeholder="e.g. Project Falcon" onChange={(e) => setCodename(e.target.value)} />
          <button className={styles.ghostBtn} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                  disabled={!!busy || codename === (im?.codename ?? '')} onClick={() => save({ codename })}>Save</button>
        </div>
      )}
      {canManage && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
          No-name IMs are made from the{' '}
          <a href="/templates/no-name-im-template.html" download style={{ color: 'var(--color-primary)', fontWeight: 600 }}>blank template</a>
          : fill it in, save it as PDF, upload it here.
        </div>
      )}
      {error && <div style={{ fontSize: '0.75rem', color: 'var(--color-destructive)', marginTop: '0.4rem' }}>{error}</div>}
    </div>
  )
}
