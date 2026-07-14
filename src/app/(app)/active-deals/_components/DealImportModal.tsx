'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import type { DealCategory } from '@/lib/types'
import { importActiveDealsCsv } from '@/app/actions/active-deals'
import { parseDealsCsv, buildDealAiInstructions, buildDealCsvTemplate } from '@/lib/active-deals-csv'
import Spinner from '@/app/_components/Spinner'
import styles from '../active-deals.module.css'

export default function DealImportModal({ categories, onClose, onImported }: {
  categories: DealCategory[]; onClose: () => void; onImported: () => void
}) {
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<{ ok: number; errors: { row: number; message: string }[] } | null>(null)
  const [result, setResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const instructions = useMemo(() => buildDealAiInstructions(categories), [categories])

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    file.text().then((text) => {
      setCsvText(text)
      setResult(null)
      const { rows, errors } = parseDealsCsv(text, categories)
      setPreview({ ok: rows.length, errors })
    })
  }

  function doImport() {
    startTransition(async () => {
      const res = await importActiveDealsCsv(csvText)
      setResult(res)
      if (res.created > 0) onImported()
    })
  }

  function copyInstructions() {
    navigator.clipboard.writeText(instructions).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  function downloadTemplate() {
    const blob = new Blob([buildDealCsvTemplate(categories)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'active-deals-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={`${styles.modalPanel} ${styles.modalPanelWide}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Import deals from CSV</div>
          <button className={styles.detailClose} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={`${styles.modalBody} ${styles.modalScroll}`}>
          <p className={styles.helpText}>
            Give the prompt below to your AI agent along with your deal list — it returns a CSV.
            Upload it here; each row becomes an active deal (portfolio / off-pipeline) and creates or
            links a company profile by name. Columns are built from <strong>your</strong> deal categories.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: showInstructions ? '0.75rem 0' : '1rem 0' }}>
            <button className={styles.ghostBtn} onClick={() => setShowInstructions((s) => !s)}>{showInstructions ? 'Hide' : 'Show'} AI agent prompt</button>
            <button className={styles.ghostBtn} onClick={copyInstructions}>{copied ? '✓ Copied' : 'Copy prompt'}</button>
            <button className={styles.ghostBtn} onClick={downloadTemplate}>Download CSV template</button>
          </div>

          {showInstructions && <div className={styles.instructionsBox} style={{ marginBottom: '1rem' }}>{instructions}</div>}

          <div className={styles.formField}>
            <label className={styles.formLabel}>CSV file</label>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button className={styles.ghostBtn} onClick={() => fileRef.current?.click()}>Choose file…</button>
              <span className={styles.fileName}>{fileName || 'No file chosen'}</span>
            </div>
          </div>

          {preview && !result && (
            <>
              <div className={preview.ok > 0 ? styles.okBox : styles.errBox}>
                {preview.ok} valid row{preview.ok === 1 ? '' : 's'} ready to import
                {preview.errors.length > 0 ? `, ${preview.errors.length} with errors` : ''}.
              </div>
              {preview.errors.length > 0 && (
                <div className={styles.errBox}>
                  {preview.errors.map((e) => <div key={e.row} className={styles.errRow}><strong>Row {e.row}:</strong> {e.message}</div>)}
                </div>
              )}
            </>
          )}

          {result && (
            <div className={result.created > 0 ? styles.okBox : styles.errBox}>
              {result.created > 0 ? `Imported ${result.created} deal${result.created === 1 ? '' : 's'}. ` : 'No deals were imported. '}
              {result.errors.length > 0 && `${result.errors.length} row(s) were skipped due to errors.`}
            </div>
          )}
        </div>
        <div className={styles.modalActions} style={{ padding: '0.85rem 1.375rem', borderTop: '1px solid var(--color-border)' }}>
          {result ? (
            <button className={styles.modalAccept} onClick={onClose}>Done</button>
          ) : (
            <>
              <button className={styles.modalCancel} onClick={onClose} disabled={pending}>Cancel</button>
              <button className={styles.modalAccept} onClick={doImport} disabled={pending || !preview || preview.ok === 0}>
                {pending
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Importing…</span>
                  : `Import ${preview?.ok ?? 0} deal${preview?.ok === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
