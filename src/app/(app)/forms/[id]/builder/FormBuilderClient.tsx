'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import StartNode from './_components/StartNode'
import EndNode from './_components/EndNode'
import QuestionNode from './_components/QuestionNode'
import PropertiesPanel from './_components/PropertiesPanel'
import { saveFormGraph, publishForm, generateFormLink, updateFormMeta } from '@/app/actions/forms'
import { generateId } from './utils'
import type { Form, FormNode, FormEdge, Pipeline } from '@/lib/types'
import styles from './builder.module.css'

const nodeTypes = { startNode: StartNode, endNode: EndNode, questionNode: QuestionNode }

function dbNodesToFlow(dbNodes: FormNode[]): Node[] {
  return dbNodes.map((n) => ({
    id: n.id,
    type: n.type === 'start' ? 'startNode' : n.type === 'end' ? 'endNode' : 'questionNode',
    position: { x: n.position_x, y: n.position_y },
    data: n.type === 'question'
      ? { questionText: n.question_text ?? '', answerType: n.answer_type ?? 'short_text', options: n.options ?? [] }
      : n.type === 'end'
        ? { subtype: n.subtype ?? 'success' }
        : {},
  }))
}

function dbEdgesToFlow(dbEdges: FormEdge[]): Edge[] {
  return dbEdges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    sourceHandle: e.condition_value ?? 'output',
    targetHandle: 'input',
    label: e.condition_label ?? undefined,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: 'var(--color-primary)', strokeWidth: 1.5 },
    labelStyle: { fontSize: '11px', fill: 'var(--color-muted)' },
    labelBgStyle: { fill: 'var(--color-card)' },
  }))
}

function flowNodesToDb(nodes: Node[], formId: string) {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type === 'startNode' ? 'start' : n.type === 'endNode' ? 'end' : 'question',
    subtype: n.type === 'endNode' ? ((n.data as any).subtype ?? 'success') : null,
    position_x: n.position.x,
    position_y: n.position.y,
    question_text: (n.data as any).questionText ?? null,
    answer_type: (n.data as any).answerType ?? null,
    options: (n.data as any).options ?? [],
  })) as Parameters<typeof saveFormGraph>[1]
}

function validateGraph(nodes: Node[], edges: Edge[]): string | null {
  const startNodes = nodes.filter((n) => n.type === 'startNode')
  if (startNodes.length !== 1) return 'Form must have exactly one Start node.'

  const endNodes = nodes.filter((n) => n.type === 'endNode')
  const hasSuccess = endNodes.some((n) => (n.data as any).subtype === 'success')
  const hasRejected = endNodes.some((n) => (n.data as any).subtype === 'rejected')
  if (!hasSuccess) return 'Add a "Submitted" end node — every form needs a success outcome.'
  if (!hasRejected) return 'Add a "Not Eligible" end node — every form needs a rejection outcome.'

  // Each output handle must connect to exactly one target
  const handleCount = new Map<string, number>()
  for (const e of edges) {
    const key = `${e.source}::${e.sourceHandle}`
    handleCount.set(key, (handleCount.get(key) ?? 0) + 1)
  }
  for (const [, count] of handleCount) {
    if (count > 1) return 'A question has multiple outgoing connections from the same output — each path must lead to exactly one place.'
  }

  const connected = new Set(edges.map((e) => `${e.source}::${e.sourceHandle}`))

  for (const node of nodes) {
    if (node.type === 'endNode') continue
    if (node.type === 'startNode') {
      if (!connected.has(`${node.id}::output`))
        return 'Start node is not connected to any question.'
    } else if (node.type === 'questionNode') {
      const data = node.data as any
      if (data.answerType === 'mcq') {
        const validOpts = (data.options ?? []).filter((o: any) => o.label.trim())
        if (validOpts.length === 0) return 'An MCQ question has no options — add at least one option.'
        for (const opt of validOpts) {
          if (!connected.has(`${node.id}::${opt.id}`))
            return `MCQ option "${opt.label}" has no outgoing connection — all options must lead somewhere.`
        }
      } else {
        if (!connected.has(`${node.id}::output`))
          return 'A question has no outgoing connection — all questions must lead somewhere.'
      }
    }
  }
  return null
}

function flowEdgesToDb(edges: Edge[]) {
  return edges.map((e) => ({
    id: e.id,
    source_node_id: e.source,
    target_node_id: e.target,
    condition_value: (e.sourceHandle && e.sourceHandle !== 'output') ? e.sourceHandle : null,
    condition_label: typeof e.label === 'string' ? e.label : null,
  }))
}

interface Props {
  form: Form
  dbNodes: FormNode[]
  dbEdges: FormEdge[]
  pipelines: Pipeline[]
}

export default function FormBuilderClient({ form, dbNodes, dbEdges, pipelines }: Props) {
  const router = useRouter()
  const [nodes, setNodes, onNodesChange] = useNodesState(dbNodesToFlow(dbNodes))
  const [edges, setEdges, onEdgesChange] = useEdgesState(dbEdgesToFlow(dbEdges))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [published, setPublished] = useState(form.published)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsTitle, setSettingsTitle] = useState(form.title)
  const [settingsDesc, setSettingsDesc] = useState(form.description ?? '')
  const [settingsPipelineId, setSettingsPipelineId] = useState(form.pipeline_id ?? '')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [isPending, startTransition] = useTransition()

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source)
      const sourceHandle = connection.sourceHandle
      let label: string | undefined
      if (sourceNode?.type === 'questionNode') {
        const opts: any[] = (sourceNode.data as any).options ?? []
        const matchedOpt = opts.find((o) => o.id === sourceHandle)
        if (matchedOpt) label = matchedOpt.label
      }
      setEdges((eds) => {
        // Each handle can only connect to one target — remove any existing edge first
        const deduped = eds.filter(
          (e) => !(e.source === connection.source && e.sourceHandle === connection.sourceHandle)
        )
        return addEdge({
          ...connection,
          id: generateId(),
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: 'var(--color-primary)', strokeWidth: 1.5 },
          label,
          labelStyle: { fontSize: '11px', fill: 'var(--color-muted)' },
          labelBgStyle: { fill: 'var(--color-card)' },
        }, deduped)
      })
    },
    [nodes, setEdges],
  )

  function addQuestion() {
    const id = generateId()
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'questionNode',
        position: { x: 200 + Math.random() * 100, y: 200 + nds.filter(n => n.type === 'questionNode').length * 160 },
        data: { questionText: '', answerType: 'short_text', options: [] },
      },
    ])
    setSelectedNodeId(id)
  }

  function updateNodeData(nodeId: string, patch: Record<string, unknown>) {
    setNodes((nds) =>
      nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)
    )
  }

  function addEndNode(subtype: 'success' | 'rejected') {
    const id = generateId()
    const endNodes = nodes.filter((n) => n.type === 'endNode')
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'endNode',
        position: { x: 150 + endNodes.length * 220, y: 520 },
        data: { subtype },
      },
    ])
  }

  async function handleSave() {
    const err = validateGraph(nodes, edges)
    if (err) { setValidationError(err); return }
    setValidationError(null)
    setSaveStatus('saving')
    try {
      await saveFormGraph(form.id, flowNodesToDb(nodes, form.id), flowEdgesToDb(edges))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }

  async function handlePublishToggle() {
    const next = !published
    setPublished(next)
    startTransition(async () => {
      await publishForm(form.id, next)
      router.refresh()
    })
  }

  async function handleSaveSettings() {
    setSettingsSaving(true)
    try {
      await updateFormMeta(form.id, settingsTitle, settingsDesc, settingsPipelineId || null)
      setShowSettingsModal(false)
      router.refresh()
    } finally {
      setSettingsSaving(false)
    }
  }

  async function handleGenerateLink() {
    startTransition(async () => {
      try {
        const result = await generateFormLink(form.id, linkLabel)
        const origin = window.location.origin
        setGeneratedLink(`${origin}/f/${result.token}`)
      } catch (err) {
        alert(String(err))
      }
    })
  }

  return (
    <div className={styles.builderWrap}>
      {/* Validation error banner */}
      {validationError && (
        <div className={styles.validationBanner}>
          <span>⚠ {validationError}</span>
          <button className={styles.validationDismiss} onClick={() => setValidationError(null)}>✕</button>
        </div>
      )}

      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <a href="/forms" className={styles.backLink}>← Forms</a>
          <div className={styles.formTitle}>{form.title}</div>
          {form.pipeline
            ? <div className={styles.formPipeline}>→ {form.pipeline.name}</div>
            : <div className={styles.formPipelineNone}>No pipeline</div>
          }
          <button className={styles.settingsBtn} onClick={() => setShowSettingsModal(true)} title="Form settings">⚙</button>
        </div>
        <div className={styles.topActions}>
          <button className={styles.addNodeBtn} onClick={addQuestion}>+ Question</button>
          <button className={styles.addEndSuccessBtn} onClick={() => addEndNode('success')}>+ Submitted</button>
          <button className={styles.addEndRejectedBtn} onClick={() => addEndNode('rejected')}>+ Not Eligible</button>
          <button
            className={`${styles.publishToggle} ${published ? styles.publishToggleOn : ''}`}
            onClick={handlePublishToggle}
            disabled={isPending}
          >
            {published ? '● Published' : '○ Draft'}
          </button>
          {published && (
            <button className={styles.linkBtn} onClick={() => { setGeneratedLink(null); setLinkLabel(''); setShowLinkModal(true) }}>
              🔗 Generate Link
            </button>
          )}
          <button
            className={`${styles.saveBtn} ${saveStatus === 'saved' ? styles.saveBtnSaved : saveStatus === 'error' ? styles.saveBtnError : ''}`}
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? 'Error' : 'Save'}
          </button>
        </div>
      </div>

      {/* Canvas + panel */}
      <div className={styles.canvasWrap}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          deleteKeyCode="Delete"
        >
          <Background color="var(--color-border)" gap={20} />
          <Controls />
          <MiniMap nodeColor={(n) => n.type === 'startNode' ? '#16a34a' : n.type === 'endNode' ? '#dc2626' : 'var(--color-primary)'} />
        </ReactFlow>

        <PropertiesPanel node={selectedNode} onUpdate={updateNodeData} />
      </div>

      {/* Settings modal */}
      {showSettingsModal && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setShowSettingsModal(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Form Settings</div>
            <div className={styles.field}>
              <label className={styles.label}>Title *</label>
              <input className={styles.input} value={settingsTitle} onChange={(e) => setSettingsTitle(e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <input className={styles.input} value={settingsDesc} onChange={(e) => setSettingsDesc(e.target.value)} placeholder="Optional" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Pipeline</label>
              {pipelines.length === 0 ? (
                <p className={styles.panelHint}>No pipelines exist yet — create one first.</p>
              ) : (
                <select className={styles.input} value={settingsPipelineId} onChange={(e) => setSettingsPipelineId(e.target.value)}>
                  <option value="">None (standalone form)</option>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <p className={styles.panelHint}>Submissions will be added as entries in the selected pipeline.</p>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowSettingsModal(false)}>Cancel</button>
              <button className={styles.submitBtn} onClick={handleSaveSettings} disabled={settingsSaving || !settingsTitle.trim()}>
                {settingsSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate link modal */}
      {showLinkModal && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setShowLinkModal(false)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Generate Shareable Link</div>
            {!generatedLink ? (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>Link Label <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>(optional)</span></label>
                  <input className={styles.input} value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="e.g. LinkedIn Campaign Jan 2026" autoFocus />
                </div>
                <p className={styles.panelHint}>The link will track which team member generated it.</p>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={() => setShowLinkModal(false)}>Cancel</button>
                  <button className={styles.submitBtn} onClick={handleGenerateLink} disabled={isPending}>{isPending ? 'Generating…' : 'Generate'}</button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.generatedLinkBox}>
                  <code className={styles.generatedLinkText}>{generatedLink}</code>
                  <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(generatedLink)}>Copy</button>
                </div>
                <p className={styles.panelHint}>Anyone with this link can fill out the form. Share it externally.</p>
                <div className={styles.modalActions}>
                  <button className={styles.submitBtn} onClick={() => setShowLinkModal(false)}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
