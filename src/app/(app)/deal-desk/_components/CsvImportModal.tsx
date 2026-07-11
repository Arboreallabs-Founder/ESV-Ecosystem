'use client'

import { useRef, useState, useTransition } from 'react'
import { importDealsCsv, type ImportResult } from '@/app/actions/deal-desk'
import { parseDeskCsv, AI_AGENT_INSTRUCTIONS, CSV_TEMPLATE } from '@/lib/deal-desk-csv'
import styles from './deal-desk.module.css'

export default function CsvImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<{ ok: number; errors: { row: number; message: string }[] } | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    file.text().then((text) => {
      setCsvText(text)
      setResult(null)
      const { rows, errors } = parseDeskCsv(text)
      setPreview({ ok: rows.length, errors })
    })
  }

  function doImport() {
    startTransition(async () => {
      const res = await importDealsCsv(csvText)
      setResult(res)
      if (res.inserted > 0) onImported()
    })
  }

  function copyInstructions() {
    navigator.clipboard.writeText(AI_AGENT_INSTRUCTIONS).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    })
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'deal-desk-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Import deals from CSV</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.sectionText} style={{ marginBottom: '1rem' }}>
            Give the prompt below to your AI agent along with your call notes — it returns a CSV.
            Upload that CSV here; each row becomes one deal card. Photos aren&rsquo;t part of the CSV:
            add them per deal in the app after import (open a deal → <strong>Add images</strong>).
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: showInstructions ? '0.75rem' : '1rem' }}>
            <button className={styles.ghostBtn} onClick={() => setShowInstructions((s) => !s)}>
              {showInstructions ? 'Hide' : 'Show'} AI agent prompt
            </button>
            <button className={styles.ghostBtn} onClick={copyInstructions}>
              {copied ? '✓ Copied' : 'Copy prompt'}
            </button>
            <button className={styles.ghostBtn} onClick={downloadTemplate}>Download CSV template</button>
          </div>

          {showInstructions && (
            <div className={styles.instructions} style={{ marginBottom: '1rem', maxHeight: 260 }}>{AI_AGENT_INSTRUCTIONS}</div>
          )}

          <div className={styles.field}>
            <label className={styles.fieldLabel}>CSV file</label>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button className={styles.ghostBtn} onClick={() => fileRef.current?.click()}>Choose file…</button>
              <span className={styles.founderAff}>{fileName || 'No file chosen'}</span>
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
                  {preview.errors.map((e) => (
                    <div key={e.row} className={styles.errRow}><strong>Row {e.row}:</strong> {e.message}</div>
                  ))}
                </div>
              )}
            </>
          )}

          {result && (
            <div className={result.inserted > 0 ? styles.okBox : styles.errBox}>
              Imported {result.inserted} deal{result.inserted === 1 ? '' : 's'}.
              {result.errors.length > 0 && ` ${result.errors.length} row(s) were skipped due to errors.`}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border)' }}>
          {result ? (
            <button className={styles.primaryBtn} onClick={onClose}>Done</button>
          ) : (
            <>
              <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
              <button className={styles.primaryBtn} onClick={doImport} disabled={pending || !preview || preview.ok === 0}>
                {pending ? 'Importing…' : `Import ${preview?.ok ?? 0} deal${preview?.ok === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
