'use client'

import { useRef } from 'react'
import { wrapSelection, generateId } from '../utils'
import { OUTPUT, optionsOf } from '../graph'
import type { Edge, Node } from '@xyflow/react'
import styles from '../builder.module.css'

interface Props {
  node: Node | null
  nodes: Node[]
  edges: Edge[]
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onSetTarget: (source: string, handle: string, target: string | null) => void
  onClearOptionLines: (nodeId: string) => void
}

/** "Goes to" for one output: every card it could lead to, in the order they appear on the canvas. */
function GoesTo({ label, value, nodes, selfId, empty, onChange }: {
  label: string
  value: string | null
  nodes: Node[]
  selfId: string
  empty: string
  onChange: (target: string | null) => void
}) {
  const choices = nodes
    .filter((n) => n.id !== selfId && n.type !== 'startNode')
    .sort((a, b) => a.position.y - b.position.y)
  const name = (n: Node) => {
    if (n.type === 'endNode') return (n.data as { subtype?: string }).subtype === 'rejected' ? '✕ Not Eligible' : '✓ Submitted'
    const text = String((n.data as { questionText?: string }).questionText ?? '').replace(/\*+/g, '').trim()
    return text.length > 60 ? `${text.slice(0, 60)}…` : text || 'Untitled question'
  }
  return (
    <select className={styles.panelSelect} aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{empty}</option>
      {choices.map((n) => <option key={n.id} value={n.id}>{name(n)}</option>)}
    </select>
  )
}

export default function PropertiesPanel({ node, nodes, edges, onUpdate, onSetTarget, onClearOptionLines }: Props) {
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
        {node.type === 'startNode' && (
          <div className={styles.panelSection}>
            <div className={styles.panelLabel}>Goes to</div>
            <GoesTo
              label="Start goes to" nodes={nodes} selfId={node.id} empty="Not connected"
              value={edges.find((e) => e.source === node.id)?.target ?? null}
              onChange={(t) => onSetTarget(node.id, OUTPUT, t)}
            />
          </div>
        )}
      </div>
    )
  }

  const data = node.data as {
    questionText: string
    answerType: 'short_text' | 'long_text' | 'mcq'
    contactField: 'name' | 'email' | 'phone' | null
    options: Array<{ id: string; label: string; position: number }>
  }

  const targetOf = (handle: string) => edges.find((e) => e.source === node.id && (e.sourceHandle ?? OUTPUT) === handle)?.target ?? null
  const choices = data.answerType === 'mcq' ? optionsOf(node) : []
  const hasOwnLines = choices.some((o) => targetOf(o.id))

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
        </div>
      )}

      <div className={styles.panelSection}>
        <div className={styles.panelLabel}>{choices.length === 0 ? 'Goes to' : hasOwnLines ? 'All other options go to' : 'All options go to'}</div>
        <GoesTo
          label="Goes to" nodes={nodes} selfId={node.id} empty="Not connected"
          value={targetOf(OUTPUT)}
          onChange={(t) => onSetTarget(node.id, OUTPUT, t)}
        />
        {choices.length > 1 && (
          <>
            <details className={styles.optionTargets} open={hasOwnLines || undefined}>
              <summary>Send an option somewhere else</summary>
              {choices.map((o) => (
                <label key={o.id} className={styles.optionTarget}>
                  <span>{o.label}</span>
                  <GoesTo
                    label={`"${o.label}" goes to`} nodes={nodes} selfId={node.id} empty="Same as above"
                    value={targetOf(o.id)}
                    onChange={(t) => onSetTarget(node.id, o.id, t)}
                  />
                </label>
              ))}
            </details>
            {hasOwnLines && targetOf(OUTPUT) && (
              <button type="button" className={styles.addOptionBtn} onClick={() => onClearOptionLines(node.id)}>Send every option the same way</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
