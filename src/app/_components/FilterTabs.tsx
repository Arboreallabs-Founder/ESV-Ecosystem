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
export default function FilterTabs({
  tabs,
  value,
  onChange,
  className = '',
}: {
  tabs: FilterTabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={`${styles.tabs} ${className}`} role="tablist">
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
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
