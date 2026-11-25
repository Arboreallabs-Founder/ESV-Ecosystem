'use client'

import { useEffect, useState } from 'react'
import { Handle, Position, useNodeConnections, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { renderFormattedText } from '../utils'
import { OUTPUT, type Option } from '../graph'
import styles from '../builder.module.css'

const ANSWER_LABELS: Record<string, string> = {
  short_text: 'Short Text',
  long_text: 'Long Text',
  mcq: 'Multiple Choice',
}

/** A longer list than this is folded to its first few options, plus any that go somewhere of their own. */
const FOLD_OVER = 9
const FOLDED = 5

export default function QuestionNode({ id, data, selected }: NodeProps) {
  const { questionText, answerType, options } = data as { questionText: string; answerType: 'short_text' | 'long_text' | 'mcq'; options: Option[] }
  const [open, setOpen] = useState(false)
  const updateInternals = useUpdateNodeInternals()
  const connections = useNodeConnections({ id, handleType: 'source' })

  const validOptions = answerType === 'mcq' ? (options ?? []).filter((o) => o.label.trim()) : []
  const ownLine = new Set(connections.map((c) => c.sourceHandle).filter((h) => validOptions.some((o) => o.id === h)))
  const folds = validOptions.length > FOLD_OVER
  const shown = folds && !open ? validOptions.filter((o, i) => i < FOLDED || ownLine.has(o.id)) : validOptions

  // The canvas caches where a card's dots are; tell it when the rows change.
  const rows = shown.map((o) => o.id).join()
  useEffect(() => { updateInternals(id) }, [id, rows, updateInternals])

  return (
    <div className={`${styles.questionNode} ${selected ? styles.questionNodeSelected : ''}`}>
      <Handle type="target" position={Position.Top} id="input" className={styles.handle} />

      <div className={styles.qBadge}>{ANSWER_LABELS[answerType] ?? 'Question'}</div>
      <div className={styles.qText}>
        {questionText ? renderFormattedText(questionText) : <span className={styles.qPlaceholder}>Untitled question…</span>}
      </div>

      {validOptions.length > 0 && (
        <div className={styles.qOptions}>
          {shown.map((opt) => (
            <div key={opt.id} className={`${styles.qOption} ${styles.qOptionRow}`}>
              <span className={styles.qOptionDot} />
              {opt.label}
              <Handle
                type="source"
                position={Position.Right}
                id={opt.id}
                className={`${styles.handle} ${styles.optionHandle} ${ownLine.has(opt.id) ? '' : styles.optionHandleFree}`}
                title={`Drag to send only "${opt.label}" somewhere else`}
              />
            </div>
          ))}
          {folds && (
            <button type="button" className={`nodrag ${styles.qFold}`} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
              {open ? 'Show fewer' : `+ ${validOptions.length - shown.length} more`}
            </button>
          )}
        </div>
      )}

      {validOptions.length > 0 && ownLine.size < validOptions.length && (
        <div className={styles.qAll}>{ownLine.size > 0 ? 'All other options' : 'All options'}</div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        id={OUTPUT}
        className={styles.handle}
        // Every option has its own line: nothing is left for this one, unless it is still connected.
        style={validOptions.length > 0 && ownLine.size === validOptions.length && !connections.some((c) => c.sourceHandle === OUTPUT) ? { visibility: 'hidden' } : undefined}
        title={validOptions.length > 0 ? 'Drag once to connect every option that has no line of its own' : undefined}
      />
    </div>
  )
}
