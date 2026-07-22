'use client'

import { useRef, useState, KeyboardEvent } from 'react'
import styles from './TagSelect.module.css'

// Multi-select with a predefined, searchable option list (tick to add/remove) plus a
// free-text "Other" fallback for values not in the list — used anywhere a form needs
// "pick from common sectors/stages/etc, but let me type something else too."
export default function TagSelect({
  options, value, onChange, placeholder = 'Search…', allowCustom = true,
}: {
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  allowCustom?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options
  const exactMatch = options.find((o) => o.toLowerCase() === q)
  const showCustomAdd = allowCustom && q.length > 0 && !exactMatch && !value.some((v) => v.toLowerCase() === q)

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt])
  }

  function addCustom() {
    const trimmed = query.trim()
    if (trimmed && !value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed])
    }
    setQuery('')
  }

  function remove(opt: string) {
    onChange(value.filter((v) => v !== opt))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (exactMatch) toggle(exactMatch)
      else if (allowCustom && query.trim()) addCustom()
    } else if (e.key === 'Backspace' && !query && value.length > 0) {
      remove(value[value.length - 1])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={styles.wrap} onClick={() => inputRef.current?.focus()}>
      {value.map((v) => (
        <span key={v} className={styles.chip}>
          {v}
          <button
            type="button"
            className={styles.chipRemove}
            onMouseDown={(e) => { e.preventDefault(); remove(v) }}
            aria-label={`Remove ${v}`}
          >×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        placeholder={value.length === 0 ? placeholder : ''}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150) }}
      />
      {open && (
        <div className={styles.dropdown} onMouseDown={(e) => e.preventDefault()}>
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              className={styles.item}
              onClick={() => toggle(opt)}
            >
              <span className={`${styles.checkbox} ${value.includes(opt) ? styles.checkboxChecked : ''}`}>
                {value.includes(opt) && '✓'}
              </span>
              {opt}
            </button>
          ))}
          {showCustomAdd && (
            <button type="button" className={styles.item} onClick={addCustom}>
              <span className={styles.checkbox} />
              Add &ldquo;{query.trim()}&rdquo;
            </button>
          )}
          {filtered.length === 0 && !showCustomAdd && (
            <div className={styles.empty}>No matches</div>
          )}
        </div>
      )}
    </div>
  )
}
