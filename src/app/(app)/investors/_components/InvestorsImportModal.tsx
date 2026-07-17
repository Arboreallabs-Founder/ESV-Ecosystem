'use client'

import { useRef, useState, useTransition } from 'react'
import { importInvestorsCsv, type InvestorImportResult } from '@/app/actions/investors'
import { parseInvestorsCsv, INVESTOR_AI_INSTRUCTIONS, INVESTOR_CSV_TEMPLATE } from '@/lib/investors-csv'
import Spinner from '@/app/_components/Spinner'
import styles from '../investors.module.css'

export default function InvestorsImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<{ ok: number; errors: { row: number; message: string }[] } | null>(null)
  const [result, setResult] = useState<InvestorImportResult | null>(null)
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
      const { rows, errors } = parseInvestorsCsv(text)
      setPreview({ ok: rows.length, errors })
    })
  }

  function doImport() {
    startTransition(async () => {
      const res = await importInvestorsCsv(csvText)
      setResult(res)
      if (res.created + res.updated > 0) onImported()
    })
  }

  function copyInstructions() {
    navigator.clipboard.writeText(INVESTOR_AI_INSTRUCTIONS).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    })
  }

  function downloadTemplate() {
    const blob = new Blob([INVESTOR_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'investors-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.importModal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.importModalHead}>
          <h2 className={styles.modalTitle}>Import investors from CSV</h2>
          <button className={styles.detailClose} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.importModalBody}>
          <p className={styles.sectionText} style={{ marginBottom: '1rem' }}>
            Give the prompt below to your AI agent along with your source list — it returns a CSV.
            Upload that CSV here; each row becomes (or updates) one investor profile. Existing
            investors are matched by name and only their <strong>blank</strong> fields are filled — tag
            lists (sectors, business types, other thesis tags) are merged in, nothing gets overwritten.
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
            <div className={styles.instructions} style={{ marginBottom: '1rem', maxHeight: 280 }}>{INVESTOR_AI_INSTRUCTIONS}</div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>CSV file</label>
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
                  {preview.errors.map((e) => (
                    <div key={e.row} className={styles.errRow}><strong>Row {e.row}:</strong> {e.message}</div>
                  ))}
                </div>
              )}
            </>
          )}

          {result && (
            <div className={result.created + result.updated > 0 ? styles.okBox : styles.errBox}>
              {result.created > 0 && `Created ${result.created} investor${result.created === 1 ? '' : 's'}. `}
              {result.updated > 0 && `Updated ${result.updated} existing profile${result.updated === 1 ? '' : 's'}. `}
              {result.created + result.updated === 0 && 'No investors were imported. '}
              {result.errors.length > 0 && `${result.errors.length} row(s) were skipped due to errors.`}
            </div>
          )}
        </div>
        <div className={styles.importModalFoot}>
          {result ? (
            <button className={styles.submitBtn} onClick={onClose}>Done</button>
          ) : (
            <>
              <button className={styles.cancelBtn} onClick={onClose} disabled={pending}>Cancel</button>
              <button className={styles.submitBtn} onClick={doImport} disabled={pending || !preview || preview.ok === 0}>
                {pending
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Importing…</span>
                  : `Import ${preview?.ok ?? 0} investor${preview?.ok === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
