'use client'

import { useState, useCallback, useEffect, useRef, useTransition } from 'react'
import { alertError } from '@/lib/client-errors'
import { useRouter } from 'next/navigation'
import {
  ReactFlow, Background, Controls, MiniMap, useNodesInitialized, useReactFlow,
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
import { OUTPUT, condenseEdges, isMcq, liveEdges, optionsOf, overlapCount, tidyPositions, validateGraph } from './graph'
import type { Form, FormNode, FormEdge, Pipeline } from '@/lib/types'
import styles from './builder.module.css'

const nodeTypes = { startNode: StartNode, endNode: EndNode, questionNode: QuestionNode }

function dbNodesToFlow(dbNodes: FormNode[]): Node[] {
  return dbNodes.map((n) => ({
    id: n.id,
    type: n.type === 'start' ? 'startNode' : n.type === 'end' ? 'endNode' : 'questionNode',
    position: { x: n.position_x, y: n.position_y },
    data: n.type === 'question'
      ? { questionText: n.question_text ?? '', answerType: n.answer_type ?? 'short_text', contactField: n.contact_field ?? null, options: n.options ?? [] }
      : n.type === 'end'
        ? { subtype: n.subtype ?? 'success' }
        : {},
  }))
}

// No labels: a line starts from its option's own row on the card.
const EDGE_LOOK = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { stroke: 'var(--color-primary)', strokeWidth: 1.5 },
}

/** Runs once the cards have been drawn and measured: a form opening with cards on top of each other is tidied. */
function WhenMeasured({ onReady }: { onReady: () => void }) {
  const ready = useNodesInitialized()
  const done = useRef(false)
  useEffect(() => {
    if (!ready || done.current) return
    done.current = true
    onReady()
  }, [ready, onReady])
  return null
}

/** Shows the top of the form, at a size that can be read: all of a long one at once is a thin strip. */
function FitOn({ tick }: { tick: number }) {
  const { fitView, getNodes } = useReactFlow()
  useEffect(() => {
    if (tick === 0) return
    requestAnimationFrame(() => {
      const top = [...getNodes()].sort((a, b) => a.position.y - b.position.y).slice(0, 6).map((n) => ({ id: n.id }))
      fitView({ nodes: top, padding: 0.1, duration: 300, maxZoom: 1 })
    })
  }, [tick, fitView, getNodes])
  return null
}

function dbEdgesToFlow(dbEdges: FormEdge[]): Edge[] {
  return dbEdges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    sourceHandle: e.condition_value ?? OUTPUT,
    targetHandle: 'input',
    ...EDGE_LOOK,
  }))
}

function flowNodesToDb(nodes: Node[], formId: string) {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type === 'startNode' ? 'start' : n.type === 'endNode' ? 'end' : 'question',
    subtype: n.type === 'endNode' ? ((n.data as any).subtype ?? 'success') : null,
    position_x: Math.round(n.position.x),
    position_y: Math.round(n.position.y),
    question_text: (n.data as any).questionText ?? null,
    answer_type: (n.data as any).answerType ?? null,
    // Carried through deliberately: saveFormGraph deletes and reinserts every node, so a field
    // that is not mapped back out here is silently dropped on the next save.
    contact_field: (n.data as any).contactField ?? null,
    options: (n.data as any).options ?? [],
  })) as Parameters<typeof saveFormGraph>[1]
}

function flowEdgesToDb(nodes: Node[], edges: Edge[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return liveEdges(nodes, edges).map((e) => {
    const option = e.sourceHandle && e.sourceHandle !== OUTPUT
      ? optionsOf(byId.get(e.source)!).find((o) => o.id === e.sourceHandle)
      : undefined
    return {
      id: e.id,
      source_node_id: e.source,
      target_node_id: e.target,
      condition_value: option?.id ?? null,
      condition_label: option?.label ?? null,
    }
  })
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
  const [settingsDisplayName, setSettingsDisplayName] = useState(form.display_name ?? '')
  const [settingsDesc, setSettingsDesc] = useState(form.description ?? '')
  const [settingsPipelineId, setSettingsPipelineId] = useState(form.pipeline_id ?? '')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [fitTick, setFitTick] = useState(0)
  /** What the form looked like before a tidy, so it can be put back. */
  const [beforeTidy, setBeforeTidy] = useState<{ nodes: Node[]; edges: Edge[]; auto: boolean } | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  /** Send one output somewhere, or nowhere. Each output leads to exactly one place. */
  const setTarget = useCallback((source: string, handle: string, target: string | null) => {
    setEdges((eds) => {
      const rest = eds.filter((e) => !(e.source === source && (e.sourceHandle ?? OUTPUT) === handle))
      if (!target) return rest
      return addEdge({ id: generateId(), source, sourceHandle: handle, target, targetHandle: 'input', ...EDGE_LOOK }, rest)
    })
  }, [setEdges])

  const onConnect = useCallback((c: Connection) => {
    setTarget(c.source, c.sourceHandle ?? OUTPUT, c.target)
  }, [setTarget])

  /** Every option goes the same way: drop the lines individual options had. */
  function clearOptionLines(nodeId: string) {
    setEdges((eds) => eds.filter((e) => e.source !== nodeId || (e.sourceHandle ?? OUTPUT) === OUTPUT))
  }

  const tidy = useCallback((auto: boolean) => {
    setBeforeTidy({ nodes, edges, auto })
    const nextEdges = condenseEdges(nodes, edges, generateId)
    const at = tidyPositions(nodes, nextEdges)
    setEdges(nextEdges)
    setNodes((nds) => nds.map((n) => ({ ...n, position: at.get(n.id) ?? n.position })))
    setFitTick((t) => t + 1)
  }, [nodes, edges, setNodes, setEdges])

  function undoTidy() {
    if (!beforeTidy) return
    const at = new Map(beforeTidy.nodes.map((n) => [n.id, n.position]))
    setNodes((nds) => nds.map((n) => ({ ...n, position: at.get(n.id) ?? n.position })))
    setEdges(beforeTidy.edges)
    setBeforeTidy(null)
    setFitTick((t) => t + 1)
  }

  const onMeasured = useCallback(() => { if (overlapCount(nodes) >= 2) tidy(true); else setFitTick((t) => t + 1) }, [nodes, tidy])

  function addQuestion() {
    const id = generateId()
    // Below the selected card, or the lowest one, and joined to it if it doesn't lead anywhere yet.
    const questions = nodes.filter((n) => n.type !== 'endNode')
    const after = (selectedNode && selectedNode.type !== 'endNode' ? selectedNode : null)
      ?? questions.reduce<Node | null>((low, n) => (!low || n.position.y > low.position.y ? n : low), null)
    const position = after
      ? { x: after.type === 'startNode' ? after.position.x - 82 : after.position.x, y: after.position.y + (after.measured?.height ?? 120) + 70 }
      : { x: 0, y: 0 }
    // Room for it: anything it would land on, and everything under that, moves down.
    const room = 200
    const blocked = nodes.some((n) => n.id !== after?.id && Math.abs(n.position.x - position.x) < 260
      && n.position.y < position.y + room - 20 && n.position.y + (n.measured?.height ?? 120) > position.y)
    setNodes((nds) => [
      ...nds.map((n) => (blocked && n.id !== after?.id && n.position.y >= position.y - 20
        ? { ...n, position: { ...n.position, y: n.position.y + room } } : n)),
      { id, type: 'questionNode', position, data: { questionText: '', answerType: 'short_text', options: [] } },
    ])
    if (after) {
      const leads = liveEdges(nodes, edges).some((e) => e.source === after.id
        && ((e.sourceHandle ?? OUTPUT) === OUTPUT || isMcq(after)))
      if (!leads) setTarget(after.id, OUTPUT, id)
    }
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
        position: {
          x: endNodes.length * 220,
          y: Math.max(0, ...nds.map((n) => n.position.y + (n.measured?.height ?? 120))) + 70,
        },
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
      await saveFormGraph(form.id, flowNodesToDb(nodes, form.id), flowEdgesToDb(nodes, edges))
      setSaveStatus('saved')
      setBeforeTidy(null)
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
      await updateFormMeta(form.id, settingsTitle, settingsDesc, settingsPipelineId || null, settingsDisplayName)
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
        alertError(err)
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

      {beforeTidy && (
        <div className={styles.tidyBanner}>
          <span>{beforeTidy.auto ? 'Some cards were on top of each other, so they have been spaced out.' : 'Tidied.'} Save to keep it.</span>
          <button type="button" className={styles.tidyUndo} onClick={undoTidy}>Undo</button>
          <button type="button" className={styles.tidyDismiss} onClick={() => setBeforeTidy(null)} aria-label="Dismiss">✕</button>
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
          <button className={styles.linkBtn} onClick={() => tidy(false)} title="Space the cards out, in order">Tidy up</button>
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
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          minZoom={0.1}
          deleteKeyCode="Delete"
        >
          <WhenMeasured onReady={onMeasured} />
          <FitOn tick={fitTick} />
          <Background color="var(--color-border)" gap={20} />
          <Controls />
          <MiniMap nodeColor={(n) => n.type === 'startNode' ? '#16a34a' : n.type === 'endNode' ? '#dc2626' : 'var(--color-primary)'} />
        </ReactFlow>

        <PropertiesPanel
          node={selectedNode}
          nodes={nodes}
          edges={edges}
          onUpdate={updateNodeData}
          onSetTarget={setTarget}
          onClearOptionLines={clearOptionLines}
        />
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
              <label className={styles.label}>Display name</label>
              <input
                className={styles.input}
                value={settingsDisplayName}
                onChange={(e) => setSettingsDisplayName(e.target.value)}
                placeholder={settingsTitle || 'Same as the title'}
              />
              <p className={styles.panelHint}>
                What people filling in the form see at the top of it. The title above stays internal
                — leave this blank to use it.
              </p>
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
