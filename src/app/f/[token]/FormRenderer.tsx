'use client'

import { useState } from 'react'
import { submitForm } from '@/app/actions/forms'
import { describeError } from '@/lib/client-errors'
import { renderFormattedText } from '@/app/(app)/forms/[id]/builder/utils'
import styles from './form.module.css'

type FormNode = {
  id: string
  type: string
  subtype: string | null
  question_text: string | null
  answer_type: string | null
  /** This question collects the submitter's name/email/phone, so we do not ask again at the end. */
  contact_field: 'name' | 'email' | 'phone' | null
  options: Array<{ id: string; label: string; position: number }>
}

type FormEdge = {
  id: string
  source_node_id: string
  target_node_id: string
  condition_value: string | null
  condition_label: string | null
}

interface FormData {
  link_id: string
  form_id: string
  form_title: string
  form_display_name: string | null
  form_description: string | null
  pipeline_id: string | null
  first_stage_id: string | null
  nodes: FormNode[]
  edges: FormEdge[]
}

export default function FormRenderer({ formData }: { formData: FormData }) {
  const { nodes, edges } = formData
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]))

  const startNode = nodes.find((n) => n.type === 'start')
  const firstQuestionId = startNode
    ? edges.find((e) => e.source_node_id === startNode.id)?.target_node_id ?? null
    : null

  const [currentNodeId, setCurrentNodeId] = useState<string | null>(firstQuestionId)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [answeredOrder, setAnsweredOrder] = useState<string[]>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Submitter info step
  const [showSubmitterStep, setShowSubmitterStep] = useState(false)
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')

  const currentNode = currentNodeId ? nodeMap[currentNodeId] : null
  const isEnd = currentNode?.type === 'end' || (!currentNode && answeredOrder.length > 0)
  const isRejected = currentNode?.type === 'end' && currentNode.subtype === 'rejected'

  // Total question count for progress
  const questionNodes = nodes.filter((n) => n.type === 'question')
  const progress = questionNodes.length > 0
    ? Math.round((answeredOrder.length / questionNodes.length) * 100)
    : 0

  function getNextNodeId(nodeId: string, answerValue: string): string | null {
    const node = nodeMap[nodeId]
    if (!node) return null
    const outEdges = edges.filter((e) => e.source_node_id === nodeId)
    if (node.answer_type === 'mcq') {
      const matched = outEdges.find((e) => e.condition_value === answerValue)
      return matched?.target_node_id ?? outEdges[0]?.target_node_id ?? null
    }
    return outEdges[0]?.target_node_id ?? null
  }

  function handleNext() {
    if (!currentNodeId || !currentNode) return
    const answer = currentAnswer.trim()
    if (!answer && currentNode.type === 'question') return

    setAnswers((prev) => ({ ...prev, [currentNodeId]: answer }))
    setAnsweredOrder((prev) => [...prev, currentNodeId])
    const nextId = getNextNodeId(currentNodeId, answer)
    setCurrentNodeId(nextId)
    setCurrentAnswer('')
  }

  function handleMcqSelect(optionId: string) {
    setCurrentAnswer(optionId)
  }

  /* What the answers already told us about who this is.
     Read from the answers rather than from the form, because a branching form can ask for a name on
     one path and not on another -- what matters is the question they actually reached. */
  const contactFromAnswers: { name: string; email: string } = { name: '', email: '' }
  for (const [nodeId, value] of Object.entries(answers)) {
    const field = nodeMap[nodeId]?.contact_field
    const text = (value ?? '').trim()
    if (!text) continue
    if (field === 'name' && !contactFromAnswers.name) contactFromAnswers.name = text
    if (field === 'email' && !contactFromAnswers.email) contactFromAnswers.email = text
  }
  const needsName = !contactFromAnswers.name
  const needsEmail = !contactFromAnswers.email
  // Nothing left to ask: the form already collected both, so the trailing step would just be us
  // asking a second time for something they typed a minute ago.
  const needsSubmitterStep = needsName || needsEmail

  function handleFinish() {
    if (needsSubmitterStep) {
      setShowSubmitterStep(true)
      return
    }
    void handleSubmit()
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    try {
      const answerPayload = Object.entries(answers).map(([nodeId, answerText]) => {
        const node = nodeMap[nodeId]
        // For MCQ, store the option label (more readable than the UUID)
        if (node?.answer_type === 'mcq') {
          const opt = node.options.find((o) => o.id === answerText)
          return { node_id: nodeId, answer_text: opt?.label ?? answerText }
        }
        return { node_id: nodeId, answer_text: answerText }
      })

      await submitForm(
        formData.link_id,
        formData.form_id,
        formData.pipeline_id,
        formData.first_stage_id,
        answerPayload,
        contactFromAnswers.name || submitterName,
        contactFromAnswers.email || submitterEmail,
      )
      setSubmitted(true)
    } catch (err) {
      // A stranger is reading this. Never a stack trace, and a stale deployment gets told to reload.
      setSubmitError(describeError(err).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.successIcon}>✓</div>
          <h1 className={styles.title}>Thank you!</h1>
          <p className={styles.sub}>Your response has been submitted successfully.</p>
        </div>
        <div className={styles.footerBrand}>Powered by Earlyseed Ventures</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.formHeader}>
          <div className={styles.brandLine}>
            <span className={styles.brandDot} />
            <span className={styles.brandName}>Earlyseed Ventures</span>
          </div>
          {/* The title is the team's internal label; the display name is what this audience
              should read. Blank means they are the same thing. */}
          <div className={styles.formTitle}>{formData.form_display_name || formData.form_title}</div>
          {formData.form_description && <div className={styles.formDesc}>{formData.form_description}</div>}
        </div>

        {/* Progress bar */}
        {questionNodes.length > 0 && !showSubmitterStep && (
          <div className={styles.progressWrap}>
            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
        )}

        {showSubmitterStep ? (
          /* Submitter info */
          <form onSubmit={handleSubmit}>
            <div className={styles.questionText}>
              {needsName ? 'Almost done — tell us a bit about yourself' : 'Almost done — where can we reach you?'}
            </div>
            {/* Only what the answers did not already give us. A form that asked for a name gets no
                name box here; one that asked for both never reaches this screen at all. */}
            {needsName && (
              <div className={styles.field}>
                <label className={styles.label}>Your Name</label>
                <input className={styles.input} value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} placeholder="Full name" />
              </div>
            )}
            {needsEmail && (
              <div className={styles.field}>
                <label className={styles.label}>Your Email</label>
                <input className={styles.input} type="email" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            )}
            {submitError && <p className={styles.errorMsg}>{submitError}</p>}
            <div className={styles.actions}>
              <button type="submit" className={styles.nextBtn} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </form>
        ) : isRejected ? (
          /* Not eligible end */
          <div>
            <div className={styles.rejectedIcon}>✕</div>
            <div className={styles.questionText} style={{ textAlign: 'center', fontWeight: 600 }}>
              Thank you for your interest
            </div>
            <p className={styles.rejectedMsg}>
              Based on your answers, you don't meet the criteria for this application at this time.
            </p>
          </div>
        ) : isEnd || currentNode?.type === 'end' ? (
          /* Success end reached */
          <div>
            <div className={styles.questionText}>You've answered all the questions.</div>
            {/* This button submits outright when the form already collected name and email, so it
                needs the error and pending states the trailing step used to own. */}
            {submitError && <p className={styles.errorMsg}>{submitError}</p>}
            <div className={styles.actions}>
              <button className={styles.nextBtn} onClick={handleFinish} disabled={submitting}>
                {needsSubmitterStep ? 'Continue →' : submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        ) : currentNode?.type === 'question' ? (
          /* Question step */
          <div>
            <div className={styles.questionText}>
              {renderFormattedText(currentNode.question_text ?? '')}
            </div>

            {currentNode.answer_type === 'mcq' ? (
              <div className={styles.mcqOptions}>
                {currentNode.options.sort((a, b) => a.position - b.position).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`${styles.mcqOption} ${currentAnswer === opt.id ? styles.mcqOptionSelected : ''}`}
                    onClick={() => handleMcqSelect(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : currentNode.answer_type === 'long_text' ? (
              <textarea
                className={styles.textarea}
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="Your answer…"
                rows={5}
                autoFocus
              />
            ) : (
              <input
                className={styles.input}
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="Your answer…"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              />
            )}

            <div className={styles.actions}>
              <button
                className={styles.nextBtn}
                onClick={handleNext}
                disabled={!currentAnswer.trim()}
              >
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.questionText} style={{ color: '#A39B95' }}>
            Loading form…
          </div>
        )}
      </div>
      <div className={styles.footerBrand}>Powered by Earlyseed Ventures</div>
    </div>
  )
}
