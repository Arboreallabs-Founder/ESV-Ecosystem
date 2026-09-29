'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Avatar from './Avatar'
import styles from './people-picker.module.css'

export type PickablePerson = { id: string; name: string | null; email: string | null; photo_url: string | null; designation?: string | null }

/**
 * Pick people as photo chips, with the same type-to-find dropdown as @mentions in to-dos: start
 * typing a name and the closest matches come up with their photo. The dropdown is portalled, so a
 * card with overflow:hidden can't clip it (the bug the mentions dropdown had first).
 */
export default function PeoplePicker({ people, value, onChange, placeholder = 'Add someone…', disabled }: {
  people: PickablePerson[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const selected = value.map((id) => byId.get(id)).filter(Boolean) as PickablePerson[]

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return people
      .filter((p) => !value.includes(p.id))
      .filter((p) => !q || (p.name ?? '').toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q))
      // First-name matches first: typing "sa" should offer Sakshay before Vasant.
      .sort((a, b) => {
        const as = (a.name ?? '').toLowerCase().startsWith(q) ? 0 : 1
        const bs = (b.name ?? '').toLowerCase().startsWith(q) ? 0 : 1
        return as - bs || (a.name ?? '').localeCompare(b.name ?? '')
      })
      .slice(0, 6)
  }, [people, value, query])

  useEffect(() => {
    if (!open || !inputRef.current) { setPos(null); return }
    const place = () => {
      const r = inputRef.current!.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 224) })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [open])

  function pick(p: PickablePerson) {
    onChange([...value, p.id])
    setQuery('')
    setActive(0)
    inputRef.current?.focus()
  }

  return (
    <div className={`${styles.picker} ${disabled ? styles.disabled : ''}`} onClick={() => inputRef.current?.focus()}>
      {selected.map((p) => (
        <span key={p.id} className={styles.chip}>
          <Avatar name={p.name} email={p.email} photoUrl={p.photo_url} size="xs" />
          <span className={styles.chipName}>{p.name || p.email}</span>
          {!disabled && (
            <button type="button" className={styles.chipX} aria-label={`Remove ${p.name ?? ''}`}
                    onClick={(e) => { e.stopPropagation(); onChange(value.filter((id) => id !== p.id)) }}>×</button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          placeholder={selected.length ? '' : placeholder}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, suggestions.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter' && open && suggestions[active]) { e.preventDefault(); pick(suggestions[active]) }
            else if (e.key === 'Backspace' && !query && value.length) onChange(value.slice(0, -1))
            else if (e.key === 'Escape') setOpen(false)
          }}
        />
      )}
      {open && pos && suggestions.length > 0 && typeof document !== 'undefined' && createPortal(
        <div className={styles.dropdown} style={{ top: pos.top, left: pos.left, width: pos.width }}>
          {suggestions.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.option} ${i === active ? styles.optionActive : ''}`}
              // mousedown, not click: the input's blur would close the list before a click lands.
              onMouseDown={(e) => { e.preventDefault(); pick(p) }}
              onMouseEnter={() => setActive(i)}
            >
              <Avatar name={p.name} email={p.email} photoUrl={p.photo_url} size="sm" />
              <span className={styles.optionText}>
                <span className={styles.optionName}>{p.name || p.email}</span>
                {p.designation && <span className={styles.optionRole}>{p.designation}</span>}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
