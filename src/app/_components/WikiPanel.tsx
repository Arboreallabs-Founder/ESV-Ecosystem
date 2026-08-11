'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import Link from 'next/link'
import { wikiFor, type WikiSection } from '@/lib/wiki'
import styles from './wiki-panel.module.css'

/**
 * Whose wiki this is.
 *
 * WikiButton is dropped into thirteen screens, none of which knows the caller's role, and threading
 * it through all of them to answer one question is the kind of prop drilling nobody maintains. The
 * app shell knows the role, so it says so once here.
 *
 * Defaults to the partner view rather than the internal one: if a provider is ever missed, the
 * failure shows the *less* privileged wiki.
 */
const WikiRoleContext = createContext<string | null>('franchise_partner')

export function WikiRoleProvider({ role, children }: { role: string | null; children: React.ReactNode }) {
  return <WikiRoleContext.Provider value={role}>{children}</WikiRoleContext.Provider>
}

function useScopedWiki() {
  const role = useContext(WikiRoleContext)
  return useMemo(() => wikiFor(role), [role])
}

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
              {item.snippet && <pre className={styles.snippet}>{item.snippet}</pre>}
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
  const wiki = useScopedWiki()
  // No section for this role means no button. A partner on a screen whose help is written for the
  // team should get nothing rather than our internal notes on how we triage them.
  const section = wiki[sectionKey]
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
  const wiki = useScopedWiki()

  function handleOpen() {
    // Whatever this role's wiki starts with — 'dashboard' does not exist in a partner's.
    setActiveKey(Object.keys(wiki)[0] ?? null)
    setOpen(true)
  }

  const section = activeKey ? wiki[activeKey] : null

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
                {Object.entries(wiki).map(([key, s]) => (
                  <button
                    key={key}
                    onClick={() => setActiveKey(key)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: 100,
                      border: '1.5px solid',
                      borderColor: activeKey === key ? 'var(--color-text)' : 'var(--color-border)',
                      background: activeKey === key ? 'var(--color-card-raised)' : 'none',
                      color: activeKey === key ? 'var(--color-text)' : 'var(--color-muted)',
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
                  {item.snippet && <pre className={styles.snippet}>{item.snippet}</pre>}
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
