'use client'

import { useRef } from 'react'
import { wrapSelection, generateId } from '../utils'
import type { Node } from '@xyflow/react'
import styles from '../builder.module.css'

interface Props {
  node: Node | null
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}

export default function PropertiesPanel({ node, onUpdate }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  if (!node) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelEmpty}>
          <div className={styles.panelEmptyIcon}>←</div>
          <div>Select a node to edit its properties</div>
        </div>
      </div>
    )
  }

  if (node.type === 'startNode' || node.type === 'endNode') {
    const endSubtype = (node.data as any).subtype as 'success' | 'rejected' | null
    return (
      <div className={styles.panel}>
        <div className={styles.panelSection}>
          <div className={styles.panelTitle}>
            {node.type === 'startNode' ? 'Start Node' : endSubtype === 'rejected' ? 'Not Eligible' : 'Submitted'}
          </div>
          <p className={styles.panelHint}>
            {node.type === 'startNode'
              ? 'Entry point of the form. Connect it to the first question.'
              : endSubtype === 'rejected'
                ? 'Flow ends here — the applicant is marked as not eligible. No submission is recorded.'
                : 'Flow ends here — the applicant\'s answers are submitted to the pipeline.'}
          </p>
        </div>
      </div>
    )
  }

  const data = node.data as {
    questionText: string
    answerType: 'short_text' | 'long_text' | 'mcq'
    contactField: 'name' | 'email' | 'phone' | null
    options: Array<{ id: string; label: string; position: number }>
  }

  function applyFormat(marker: '**' | '*') {
    const el = textareaRef.current
    if (!el) return
    const { newText, newSelStart, newSelEnd } = wrapSelection(data.questionText ?? '', el.selectionStart, el.selectionEnd, marker)
    onUpdate(node!.id, { questionText: newText })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(newSelStart, newSelEnd)
    })
  }

  function addOption() {
    const opts = [...(data.options ?? []), { id: generateId(), label: '', position: (data.options ?? []).length }]
    onUpdate(node!.id, { options: opts })
  }

  function updateOption(id: string, label: string) {
    const opts = (data.options ?? []).map((o) => o.id === id ? { ...o, label } : o)
    onUpdate(node!.id, { options: opts })
  }

  function removeOption(id: string) {
    const opts = (data.options ?? []).filter((o) => o.id !== id).map((o, i) => ({ ...o, position: i }))
    onUpdate(node!.id, { options: opts })
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelSection}>
        <div className={styles.panelTitle}>Question</div>

        {/* Text formatting toolbar */}
        <div className={styles.formatBar}>
          <button type="button" className={styles.formatBtn} onClick={() => applyFormat('**')} title="Bold (Ctrl+B)">
            <strong>B</strong>
          </button>
          <button type="button" className={styles.formatBtn} onClick={() => applyFormat('*')} title="Italic (Ctrl+I)">
            <em>I</em>
          </button>
          <span className={styles.formatHint}>Select text, then click</span>
        </div>

        <textarea
          ref={textareaRef}
          className={styles.panelTextarea}
          value={data.questionText ?? ''}
          onChange={(e) => onUpdate(node.id, { questionText: e.target.value })}
          placeholder="Type your question here…"
          rows={4}
        />
      </div>

      <div className={styles.panelSection}>
        <div className={styles.panelLabel}>Answer Type</div>
        <select
          className={styles.panelSelect}
          value={data.answerType ?? 'short_text'}
          onChange={(e) => {
            const at = e.target.value as 'short_text' | 'long_text' | 'mcq'
            // Cleared on the way to mcq: a set of options is not somebody's name, and the control
            // below is hidden for mcq, so a stale tag would be invisible and unclearable.
            onUpdate(node.id, {
              answerType: at,
              options: at === 'mcq' ? (data.options ?? []) : [],
              ...(at === 'mcq' ? { contactField: null } : {}),
            })
          }}
        >
          <option value="short_text">Short Text</option>
          <option value="long_text">Long Text</option>
          <option value="mcq">Multiple Choice (MCQ)</option>
        </select>
      </div>

      {/* Without this the renderer asks for name and email again after the last question, because
          it has no way to know that one of these questions already collected them. */}
      {data.answerType !== 'mcq' && (
        <div className={styles.panelSection}>
          <div className={styles.panelLabel}>Collects</div>
          <select
            className={styles.panelSelect}
            value={data.contactField ?? ''}
            onChange={(e) => onUpdate(node.id, { contactField: e.target.value || null })}
          >
            <option value="">Nothing special</option>
            <option value="name">Their name</option>
            <option value="email">Their email</option>
            <option value="phone">Their phone number</option>
          </select>
          <p className={styles.panelHint}>
            Set this when the question asks who they are. We then skip asking for it again at the end.
          </p>
        </div>
      )}

      {data.answerType === 'mcq' && (
        <div className={styles.panelSection}>
          <div className={styles.panelLabel}>Options</div>
          <div className={styles.optionList}>
            {(data.options ?? []).map((opt, i) => (
              <div key={opt.id} className={styles.optionRow}>
                <span className={styles.optionNum}>{i + 1}</span>
                <input
                  className={styles.optionInput}
                  value={opt.label}
                  onChange={(e) => updateOption(opt.id, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                />
                <button type="button" className={styles.optionRemove} onClick={() => removeOption(opt.id)}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" className={styles.addOptionBtn} onClick={addOption}>+ Add Option</button>
          {(data.options ?? []).length > 0 && (
            <p className={styles.panelHint}>Each option creates a separate output handle — connect them to different next questions.</p>
          )}
        </div>
      )}
    </div>
  )
}
