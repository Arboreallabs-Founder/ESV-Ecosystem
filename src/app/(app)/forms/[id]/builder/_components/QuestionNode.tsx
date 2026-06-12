'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { renderFormattedText } from '../utils'
import styles from '../builder.module.css'

const ANSWER_LABELS: Record<string, string> = {
  short_text: 'Short Text',
  long_text: 'Long Text',
  mcq: 'Multiple Choice',
}

export default function QuestionNode({ data, selected }: NodeProps) {
  const { questionText, answerType, options } = data as {
    questionText: string
    answerType: 'short_text' | 'long_text' | 'mcq'
    options: Array<{ id: string; label: string; position: number }>
  }

  const isMcq = answerType === 'mcq'
  const validOptions = (options ?? []).filter((o) => o.label.trim())

  return (
    <div className={`${styles.questionNode} ${selected ? styles.questionNodeSelected : ''}`}>
      <Handle type="target" position={Position.Top} id="input" className={styles.handle} />

      <div className={styles.qBadge}>{ANSWER_LABELS[answerType] ?? 'Question'}</div>
      <div className={styles.qText}>
        {questionText ? renderFormattedText(questionText) : <span className={styles.qPlaceholder}>Untitled question…</span>}
      </div>

      {isMcq && validOptions.length > 0 && (
        <div className={styles.qOptions}>
          {validOptions.map((opt) => (
            <div key={opt.id} className={styles.qOption}>
              <span className={styles.qOptionDot} />
              {opt.label}
            </div>
          ))}
        </div>
      )}

      {isMcq && validOptions.length > 0 ? (
        validOptions.map((opt, i) => (
          <Handle
            key={opt.id}
            type="source"
            position={Position.Bottom}
            id={opt.id}
            style={{ left: `${((i + 1) / (validOptions.length + 1)) * 100}%` }}
            className={styles.handle}
          />
        ))
      ) : (
        <Handle type="source" position={Position.Bottom} id="output" className={styles.handle} />
      )}
    </div>
  )
}
