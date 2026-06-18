'use client'

import { useRef, useState } from 'react'
import styles from './Combobox.module.css'

export type ComboOption = { id: string; label: string; hint?: string }

// Type-ahead single-select: typing filters to the closest matches; picking one
// commits it; if nothing is picked the value stays blank. Shared across the app.
export default function Combobox({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  options: ComboOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
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
        disabled={disabled}
        onFocus={() => { setOpen(true); setQuery(selectedLabel) }}
        onChange={(e) => { setOpen(true); setQuery(e.target.value); if (value) onChange('') }}
        onBlur={() => { blurTimer.current = setTimeout(() => { setOpen(false); setQuery('') }, 150) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && open && filtered.length > 0) { e.preventDefault(); select(filtered[0]) }
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && !disabled && (
        <div className={styles.dropdown} onMouseDown={(e) => e.preventDefault()}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>No matches</div>
          ) : (
            filtered.map((o) => (
              <button key={o.id} type="button" className={styles.item} onClick={() => select(o)}>
                <span className={styles.itemLabel}>{o.label}</span>
                {o.hint && <span className={styles.hint}>{o.hint}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
