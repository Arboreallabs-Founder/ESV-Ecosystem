'use client'

import { useRef, useState, useTransition } from 'react'
import { importCompaniesCsv, type CompanyImportResult } from '@/app/actions/companies'
import { parseCompaniesCsv, COMPANY_AI_INSTRUCTIONS, COMPANY_CSV_TEMPLATE } from '@/lib/companies-csv'
import Spinner from '@/app/_components/Spinner'
import styles from '../companies.module.css'

export default function CompaniesImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<{ ok: number; errors: { row: number; message: string }[] } | null>(null)
  const [result, setResult] = useState<CompanyImportResult | null>(null)
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
      const { rows, errors } = parseCompaniesCsv(text)
      setPreview({ ok: rows.length, errors })
    })
  }

  function doImport() {
    startTransition(async () => {
      const res = await importCompaniesCsv(csvText)
      setResult(res)
      if (res.created + res.updated > 0) onImported()
    })
  }

  function copyInstructions() {
    navigator.clipboard.writeText(COMPANY_AI_INSTRUCTIONS).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    })
  }

  function downloadTemplate() {
    const blob = new Blob([COMPANY_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'companies-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Import companies from CSV</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.sectionText} style={{ marginBottom: '1rem' }}>
            Give the prompt below to your AI agent along with your source list — it returns a CSV.
            Upload that CSV here; each row becomes (or updates) one company profile. Existing
            companies are matched by name and only their <strong>blank</strong> fields are filled — nothing you&rsquo;ve
            entered gets overwritten. Logos and funding-round detail are added per company in the app after import.
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
            <div className={styles.instructions} style={{ marginBottom: '1rem', maxHeight: 280 }}>{COMPANY_AI_INSTRUCTIONS}</div>
          )}

          <div className={styles.field}>
            <label className={styles.fieldLabel}>CSV file</label>
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
              {result.created > 0 && `Created ${result.created} company${result.created === 1 ? '' : 's'}. `}
              {result.updated > 0 && `Updated ${result.updated} existing profile${result.updated === 1 ? '' : 's'}. `}
              {result.created + result.updated === 0 && 'No companies were imported. '}
              {result.errors.length > 0 && `${result.errors.length} row(s) were skipped due to errors.`}
            </div>
          )}
        </div>
        <div className={styles.modalFoot}>
          {result ? (
            <button className={styles.primaryBtn} onClick={onClose}>Done</button>
          ) : (
            <>
              <button className={styles.ghostBtn} onClick={onClose} disabled={pending}>Cancel</button>
              <button className={styles.primaryBtn} onClick={doImport} disabled={pending || !preview || preview.ok === 0}>
                {pending
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Spinner size={14} className="spinnerOnPrimary" /> Importing…</span>
                  : `Import ${preview?.ok ?? 0} compan${preview?.ok === 1 ? 'y' : 'ies'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
