'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WIKI, type WikiSection } from '@/lib/wiki'
import styles from './wiki-panel.module.css'

function Panel({ section, onClose }: { section: WikiSection; onClose: () => void }) {
  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>Help — {section.title}</div>
          <button className={styles.panelClose} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.panelBody}>
          <p className={styles.summary}>{section.summary}</p>
          {section.items.map((item) => (
            <div key={item.heading} className={styles.item}>
              <div className={styles.itemHeading}>{item.heading}</div>
              <div className={styles.itemBody}>{item.body}</div>
            </div>
          ))}
          <Link href="/wiki" className={styles.wikiLink} onClick={onClose}>
            View full Wiki →
          </Link>
        </div>
      </aside>
    </>
  )
}

export function WikiButton({ sectionKey }: { sectionKey: string }) {
  const [open, setOpen] = useState(false)
  const section = WIKI[sectionKey]
  if (!section) return null

  return (
    <>
      <button
        className={styles.trigger}
        onClick={() => setOpen(true)}
        title={`Help: ${section.title}`}
        aria-label={`Help for ${section.title}`}
      >
        ?
      </button>
      {open && <Panel section={section} onClose={() => setOpen(false)} />}
    </>
  )
}

export function WikiSidebarButton() {
  const [open, setOpen] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  function handleOpen() {
    setActiveKey('dashboard')
    setOpen(true)
  }

  const section = activeKey ? WIKI[activeKey] : null

  return (
    <>
      <button className={styles.sidebarWikiItem} onClick={handleOpen}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
        Help & Wiki
      </button>
      {open && section && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>Help & Wiki</div>
              <button className={styles.panelClose} onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className={styles.panelBody}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                {Object.entries(WIKI).map(([key, s]) => (
                  <button
                    key={key}
                    onClick={() => setActiveKey(key)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: 100,
                      border: '1.5px solid',
                      borderColor: activeKey === key ? 'var(--color-primary)' : 'var(--color-border)',
                      background: activeKey === key ? 'rgba(116,95,253,0.1)' : 'none',
                      color: activeKey === key ? 'var(--color-primary)' : 'var(--color-muted)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
              <p className={styles.summary}>{section.summary}</p>
              {section.items.map((item) => (
                <div key={item.heading} className={styles.item}>
                  <div className={styles.itemHeading}>{item.heading}</div>
                  <div className={styles.itemBody}>{item.body}</div>
                </div>
              ))}
              <Link href="/wiki" className={styles.wikiLink} onClick={() => setOpen(false)}>
                View full Wiki →
              </Link>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
