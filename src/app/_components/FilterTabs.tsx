'use client'

import styles from './filter-tabs.module.css'

export type FilterTabItem = {
  value: string
  label: string
  count?: number
  dot?: string // optional colour dot (e.g. category colour)
}

// Segmented pill filter bar. The active pill gets an ESV purple gradient.
// Shared across Investors, Active Deals, Deal Desk, Escalations.
//
// Multi-select is opt-in via `values`. Seven pages pass `value` and none of them change: adding a
// second prop rather than widening the type of the first is what keeps this a safe edit to a
// component that much of the app depends on.
//
// The roles differ with the mode on purpose. A single-select bar is a tablist and its buttons are
// tabs; a multi-select bar is a set of independent toggles, and calling those tabs tells a screen
// reader that picking one deselects the rest, which is exactly what it no longer does.
export default function FilterTabs({
  tabs,
  value,
  values,
  onChange,
  className = '',
}: {
  tabs: FilterTabItem[]
  /** Single-select. Ignored when `values` is given. */
  value?: string
  /** Multi-select: everything in here is active, and onChange is a toggle. */
  values?: string[]
  onChange: (value: string) => void
  className?: string
}) {
  const multi = values !== undefined
  return (
    <div className={`${styles.tabs} ${className}`} role={multi ? 'group' : 'tablist'}>
      {tabs.map((t) => {
        const active = multi ? values!.includes(t.value) : t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role={multi ? undefined : 'tab'}
            aria-selected={multi ? undefined : active}
            aria-pressed={multi ? active : undefined}
            className={`${styles.tab} ${active ? styles.tabActive : ''}`}
            onClick={() => onChange(t.value)}
          >
            {t.dot && <span className={styles.dot} style={{ background: t.dot }} />}
            <span>{t.label}</span>
            {t.count != null && <span className={styles.count}>{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
