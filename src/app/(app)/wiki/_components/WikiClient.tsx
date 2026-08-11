'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { WIKI, WIKI_GROUPS, UNGROUPED_WIKI_KEYS, type WikiItem, type WikiSection } from '@/lib/wiki'
import styles from '../wiki.module.css'

/**
 * The full wiki.
 *
 * The first version was thirty cards in a grid with a flat list of thirty links beside it. That is
 * a pile of documentation, not a reference: nothing tells you where to start, the nav is as long as
 * the content, and the only way to find "why is my investor list empty" is to read until you hit it.
 *
 * So: search first, because that is how anyone with a specific question actually arrives; grouped
 * navigation, because the order these were written in is not the order anyone looks for them; and
 * one readable column of sections rather than a masonry of cards, with the items inside each
 * section flowing into as many columns as the viewport can hold.
 */

type Group = { title: string; keys: string[] }

const GROUPS: Group[] = [
  ...WIKI_GROUPS,
  // Anything added to WIKI but not to a group still shows up, rather than vanishing quietly.
  ...(UNGROUPED_WIKI_KEYS.length ? [{ title: 'More', keys: UNGROUPED_WIKI_KEYS }] : []),
]

function matches(section: WikiSection, q: string): boolean {
  if (!q) return true
  const hay = [
    section.title,
    section.summary,
    ...section.items.flatMap((i) => [i.heading, i.body, i.snippet ?? '']),
  ].join(' ').toLowerCase()
  return q.split(/\s+/).filter(Boolean).every((word) => hay.includes(word))
}

function itemMatches(item: WikiItem, q: string): boolean {
  if (!q) return true
  const hay = `${item.heading} ${item.body} ${item.snippet ?? ''}`.toLowerCase()
  return q.split(/\s+/).filter(Boolean).every((word) => hay.includes(word))
}

export default function WikiClient() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string>(GROUPS[0]?.keys[0] ?? '')
  const searchRef = useRef<HTMLInputElement>(null)
  const q = query.trim().toLowerCase()

  // Which sections survive the search, grouped, with empty groups dropped.
  const shown = useMemo(() => {
    return GROUPS
      .map((g) => ({
        title: g.title,
        keys: g.keys.filter((k) => WIKI[k] && matches(WIKI[k], q)),
      }))
      .filter((g) => g.keys.length > 0)
  }, [q])

  const hitCount = shown.reduce((n, g) => n + g.keys.length, 0)

  // "/" focuses the search from anywhere on the page — the shortcut people already expect from
  // every other docs site. Escape clears it rather than only blurring, so one key gets you back to
  // the whole wiki.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape' && typing && el === searchRef.current) {
        setQuery('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Highlight where you are in the nav. The app shell's <main> is the scroll container, not the
  // window, so the observer has to be rooted on it or nothing ever intersects.
  useEffect(() => {
    const root = document.querySelector('main') ?? null
    const headings = Array.from(document.querySelectorAll<HTMLElement>('[data-wiki-section]'))
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.getAttribute('data-wiki-section') ?? '')
      },
      { root, rootMargin: '0px 0px -70% 0px', threshold: 0 },
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [hitCount])

  function jump(key: string) {
    const el = document.getElementById(key)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(key)
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>Wiki &amp; Help</h1>
          <p className={styles.subtitle}>
            Every screen in Ecosystem, what it is for, and the decisions baked into it. The same
            text sits behind the <strong>?</strong> on each page — this is all of it at once.
          </p>
        </div>

        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={searchRef}
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the wiki…"
            aria-label="Search the wiki"
          />
          {query
            ? <button className={styles.searchClear} onClick={() => setQuery('')} aria-label="Clear search">✕</button>
            : <kbd className={styles.kbd}>/</kbd>}
        </div>
      </header>

      {q && (
        <div className={styles.resultLine} role="status">
          {hitCount === 0
            ? <>Nothing matches <strong>{query}</strong>. Try a single word — the search looks at every heading and every sentence.</>
            : <>{hitCount} section{hitCount === 1 ? '' : 's'} match <strong>{query}</strong>.</>}
        </div>
      )}

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Wiki contents">
          {shown.map((group) => (
            <div key={group.title} className={styles.navGroup}>
              <div className={styles.navGroupTitle}>{group.title}</div>
              {group.keys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={key === active ? styles.navLinkActive : styles.navLink}
                  onClick={() => jump(key)}
                >
                  {WIKI[key].title}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.content}>
          {hitCount === 0 && q ? (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>No match</div>
              <p className={styles.emptyBody}>
                If this is something the app does and the wiki does not cover, that is worth saying —
                a gap here is usually a gap someone else hit first.
              </p>
            </div>
          ) : (
            shown.map((group) => (
              <section key={group.title} className={styles.groupBlock}>
                <h2 className={styles.groupHeading}>{group.title}</h2>

                {group.keys.map((key) => {
                  const section = WIKI[key]
                  // Inside a matching section, narrow to the matching items — landing on a section
                  // and still having to read all of it is barely better than no search.
                  const items = q ? section.items.filter((i) => itemMatches(i, q)) : section.items
                  const visible = items.length > 0 ? items : section.items

                  return (
                    <article key={key} id={key} data-wiki-section={key} className={styles.section}>
                      <div className={styles.sectionHead}>
                        <h3 className={styles.sectionTitle}>{section.title}</h3>
                        <a className={styles.anchor} href={`#${key}`} aria-label={`Link to ${section.title}`}>#</a>
                      </div>
                      <p className={styles.sectionSummary}>{section.summary}</p>

                      <div className={styles.items}>
                        {visible.map((item) => (
                          <div key={item.heading} className={styles.item}>
                            <div className={styles.itemHeading}>{item.heading}</div>
                            <div className={styles.itemBody}>{item.body}</div>
                            {/* A sketch of the real screen. Half of what people get stuck on is not
                                what a thing does but what it looks like when it is working. */}
                            {item.snippet && <pre className={styles.snippet}>{item.snippet}</pre>}
                          </div>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
