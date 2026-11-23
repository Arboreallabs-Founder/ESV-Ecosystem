'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { describeError } from '@/lib/client-errors'
import { saveDealIm } from '@/app/actions/deal-book'
import type { DealBookIm } from '@/lib/deal-book'
import { uploadDealBookPdf, viewDealBookPdf } from '@/app/(app)/deal-book/_components/upload'
import styles from '../active-deals.module.css'

/**
 * This deal's files for the Deal Book (20261124000000): the IM, the no-name IM made from the blank
 * template, and the codename the no-name book uses. Founders and admins upload; everyone else sees
 * what's there.
 */
export default function DealBookImPanel({ dealId, orgId, im, canManage }: {
  dealId: string
  orgId: string
  im: DealBookIm | null
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [codename, setCodename] = useState(im?.codename ?? '')

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

  if (!canManage && !im?.named_path && !im?.noname_path) return null

  return (
    <div className={styles.card} style={{ padding: '1rem 1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Deal Book IM</div>
        <Link href="/deal-book" style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>Open the Deal Book →</Link>
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
