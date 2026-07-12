'use client'

import { useState } from 'react'
import styles from './deal-desk.module.css'

// Renders notes as a numbered list (split on ';'). Prose with no semicolons falls back to
// a plain paragraph. Caps visible items; "+N more" reveals the rest, continuing the count.
const CAP = 6

export default function NotesList({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false)
  const facts = notes.split(';').map((s) => s.trim()).filter(Boolean)

  if (facts.length <= 1) return <div className={styles.sectionText}>{notes}</div>

  const hidden = facts.length - CAP
  const shown = expanded ? facts : facts.slice(0, CAP)

  return (
    <div>
      <ol className={styles.notesList}>
        {shown.map((f, i) => <li key={i}>{f}</li>)}
      </ol>
      {!expanded && hidden > 0 && (
        <button className={styles.moreChip} onClick={() => setExpanded(true)}>+{hidden} more</button>
      )}
    </div>
  )
}
