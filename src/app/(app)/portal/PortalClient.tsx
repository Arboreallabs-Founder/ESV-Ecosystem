'use client'

import { useState, useTransition } from 'react'
import { generateFormLink } from '@/app/actions/forms'
import type { PartnerFormLink } from '@/lib/types'
import styles from './portal.module.css'

type PublishedForm = { id: string; title: string; pipeline: { name: string } | null }

export default function PortalClient({
  partnerName,
  franchisePartnerId,
  publishedForms,
  partnerLinks: initialLinks,
}: {
  partnerName: string
  franchisePartnerId: string | null
  publishedForms: PublishedForm[]
  partnerLinks: PartnerFormLink[]
}) {
  const [links, setLinks] = useState(initialLinks)
  const [selectedFormId, setSelectedFormId] = useState(publishedForms[0]?.id ?? '')
  const [linkLabel, setLinkLabel] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState<string | null>(null)

  function copy(url: string, id: string) {
    navigator.clipboard.writeText(url)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  function handleGenerate() {
    if (!selectedFormId) return
    startTransition(async () => {
      try {
        const result = await generateFormLink(selectedFormId, linkLabel)
        const url = `${window.location.origin}/f/${result.token}`
        setGeneratedUrl(url)
        const form = publishedForms.find((f) => f.id === selectedFormId)
        setLinks((prev) => [{
          id: result.id,
          token: result.token,
          label: linkLabel.trim() || null,
          created_at: new Date().toISOString(),
          form: form ? { id: form.id, title: form.title } : null,
          pipeline: form?.pipeline ?? null,
        }, ...prev])
        setLinkLabel('')
      } catch (err) { alert(String(err)) }
    })
  }

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Partner Portal</h1>
          <p className={styles.sub}>Welcome, {partnerName}.</p>
        </div>
      </div>

      {!franchisePartnerId ? (
        <div className={styles.setupNotice}>
          <strong>Account not fully set up.</strong>
          <br />
          Your partner account hasn&apos;t been linked yet. Contact an admin to complete your setup.
        </div>
      ) : (
        <>
          {/* Generate new link */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Generate a Submission Link</div>
            <div className={styles.generateRow}>
              {publishedForms.length === 0 ? (
                <p className={styles.emptyNote}>No published forms available yet. Ask an admin to publish a form.</p>
              ) : (
                <>
                  <select className={styles.select} value={selectedFormId} onChange={(e) => { setSelectedFormId(e.target.value); setGeneratedUrl(null) }}>
                    {publishedForms.map((f) => (
                      <option key={f.id} value={f.id}>{f.title}{f.pipeline ? ` → ${f.pipeline.name}` : ''}</option>
                    ))}
                  </select>
                  <input
                    className={styles.input}
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="Label (optional, e.g. LinkedIn Campaign)"
                  />
                  <button className={styles.generateBtn} onClick={handleGenerate} disabled={isPending}>
                    {isPending ? 'Generating…' : '+ Generate Link'}
                  </button>
                </>
              )}
            </div>
            {generatedUrl && (
              <div className={styles.generatedBox}>
                <code className={styles.generatedUrl}>{generatedUrl}</code>
                <button className={styles.copyBtnSm} onClick={() => copy(generatedUrl, 'new')}>
                  {copied === 'new' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          {/* Your issued links */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Your Issued Links <span className={styles.sectionCount}>{links.length}</span></div>
            {links.length === 0 ? (
              <p className={styles.emptyNote}>No links generated yet. Use the form above to create one.</p>
            ) : (
              <div className={styles.linkList}>
                {links.map((l) => {
                  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/f/${l.token}`
                  return (
                    <div key={l.id} className={styles.linkRow}>
                      <div className={styles.linkRowLeft}>
                        <div className={styles.linkRowTitle}>
                          {l.form?.title ?? 'Form'}
                          {l.label && <span className={styles.linkRowLabel}>{l.label}</span>}
                          {l.pipeline && <span className={styles.linkRowPipeline}>→ {l.pipeline.name}</span>}
                        </div>
                        <div className={styles.linkRowMeta}>
                          {new Date(l.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className={styles.linkRowUrl}>
                          <code className={styles.linkUrlText}>/f/{l.token.slice(0, 14)}…</code>
                        </div>
                      </div>
                      <button className={styles.copyBtnSm} onClick={() => copy(url, l.id)}>
                        {copied === l.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
