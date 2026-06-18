'use client'

import { useRef, useState } from 'react'
import styles from '../escalations.module.css'

export type ComboOption = { id: string; label: string; hint?: string }

// Type-ahead single-select: typing filters to the closest matches; picking one
// commits it; if nothing is picked the value stays blank.
export default function Combobox({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: ComboOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedLabel = options.find((o) => o.id === value)?.label ?? ''
  const text = open ? query : selectedLabel
  const q = query.trim().toLowerCase()
  const filtered = (open && q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options).slice(0, 8)

  function select(opt: ComboOption) {
    onChange(opt.id)
    setQuery(opt.label)
    setOpen(false)
  }

  return (
    <div className={styles.combo}>
      <input
        className={styles.input}
        value={text}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(selectedLabel) }}
        onChange={(e) => { setOpen(true); setQuery(e.target.value); if (value) onChange('') }}
        onBlur={() => { blurTimer.current = setTimeout(() => { setOpen(false); setQuery('') }, 150) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && open && filtered.length > 0) { e.preventDefault(); select(filtered[0]) }
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && (
        <div className={styles.comboDropdown} onMouseDown={(e) => e.preventDefault()}>
          {filtered.length === 0 ? (
            <div className={styles.comboEmpty}>No matches</div>
          ) : (
            filtered.map((o) => (
              <button key={o.id} type="button" className={styles.comboItem} onClick={() => select(o)}>
                <span className={styles.comboItemLabel}>{o.label}</span>
                {o.hint && <span className={styles.comboHint}>{o.hint}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
