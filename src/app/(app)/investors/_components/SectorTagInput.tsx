'use client'

import { useRef, KeyboardEvent } from 'react'
import styles from '../investors.module.css'

type Props = {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}

export default function SectorTagInput({ value, onChange, placeholder = 'Add sector…' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function commit(raw: string) {
    const trimmed = raw.trim().replace(/,+$/, '').trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault()
      commit(inputRef.current?.value ?? '')
    } else if (e.key === 'Backspace' && !inputRef.current?.value && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  function handleBlur() {
    if (inputRef.current?.value) commit(inputRef.current.value)
  }

  return (
    <div className={styles.tagInputWrap} onClick={() => inputRef.current?.focus()}>
      {value.map((sector) => (
        <span key={sector} className={styles.tagChip}>
          {sector}
          <button
            type="button"
            className={styles.tagChipRemove}
            onClick={(e) => { e.stopPropagation(); onChange(value.filter((s) => s !== sector)) }}
            aria-label={`Remove ${sector}`}
          >×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className={styles.tagInput}
        placeholder={value.length === 0 ? placeholder : ''}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  )
}
