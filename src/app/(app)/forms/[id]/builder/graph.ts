import type { Node, Edge } from '@xyflow/react'

/* The form graph, apart from the canvas that draws it.

   A multiple-choice card has one line per option it treats specially, from that option's own row, and
   one line from its 'output' for every option without one ("All options", or "All other options"). In
   the database a line from 'output' has no condition_value; the public form and submit_website_form
   both take an option's own line first and fall back to that one. */

export type Option = { id: string; label: string; position: number }
export const OUTPUT = 'output'

type QData = { answerType?: string; options?: Option[] }
export const isMcq = (n: Node) => n.type === 'questionNode' && (n.data as QData).answerType === 'mcq'
export const optionsOf = (n: Node): Option[] => ((n.data as QData).options ?? []).filter((o) => o.label.trim())

/** Lines that still start somewhere: an option since deleted, or an answer type since changed, leaves none. */
export function liveEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return edges.filter((e) => {
    const source = byId.get(e.source)
    if (!source || !byId.has(e.target)) return false
    const handle = e.sourceHandle ?? OUTPUT
    return handle === OUTPUT || (isMcq(source) && optionsOf(source).some((o) => o.id === handle))
  })
}

export function validateGraph(nodes: Node[], allEdges: Edge[]): string | null {
  const edges = liveEdges(nodes, allEdges)
  if (nodes.filter((n) => n.type === 'startNode').length !== 1) return 'Form must have exactly one Start node.'
  if (!nodes.some((n) => n.type === 'endNode' && (n.data as { subtype?: string }).subtype === 'success')) {
    return 'Add a "Submitted" end node — every form needs a success outcome.'
  }

  const count = new Map<string, number>()
  for (const e of edges) {
    const key = `${e.source}::${e.sourceHandle ?? OUTPUT}`
    count.set(key, (count.get(key) ?? 0) + 1)
    if (count.get(key)! > 1) return 'A question has multiple outgoing connections from the same output — each path must lead to exactly one place.'
  }
  const name = (n: Node) => `"${String((n.data as { questionText?: string }).questionText ?? '').slice(0, 60) || 'Untitled question'}"`
  for (const n of nodes) {
    if (n.type === 'endNode') continue
    const out = count.has(`${n.id}::${OUTPUT}`)
    if (n.type === 'startNode') {
      if (!out) return 'Start node is not connected to any question.'
    } else if (isMcq(n)) {
      const opts = optionsOf(n)
      if (opts.length === 0) return `${name(n)} has no options — add at least one.`
      const loose = opts.find((o) => !count.has(`${n.id}::${o.id}`))
      if (!out && loose) return `${name(n)}: "${loose.label}" leads nowhere. Connect it, or connect "All options".`
    } else if (!out) {
      return `${name(n)} has no outgoing connection — all questions must lead somewhere.`
    }
  }
  return null
}

/** Where a question has several options all going to one place, one "all other options" line says it. */
export function condenseEdges(nodes: Node[], allEdges: Edge[], newId: () => string): Edge[] {
  let edges = liveEdges(nodes, allEdges)
  for (const n of nodes) {
    if (!isMcq(n) || edges.some((e) => e.source === n.id && (e.sourceHandle ?? OUTPUT) === OUTPUT)) continue
    const mine = edges.filter((e) => e.source === n.id)
    // Only when every option is connected: otherwise the new line would also catch the unconnected ones.
    if (mine.length < 2 || optionsOf(n).some((o) => !mine.some((e) => e.sourceHandle === o.id))) continue
    const byTarget = new Map<string, Edge[]>()
    for (const e of mine) byTarget.set(e.target, [...(byTarget.get(e.target) ?? []), e])
    const [target, group] = [...byTarget].sort((a, b) => b[1].length - a[1].length)[0]
    if (group.length < 2) continue
    const drop = new Set(group.map((e) => e.id))
    edges = [...edges.filter((e) => !drop.has(e.id)), { ...group[0], id: newId(), sourceHandle: OUTPUT, target, data: {}, label: undefined }]
  }
  return edges
}

const GAP_Y = 70
const COL = 360
const size = (n: Node) => ({ w: n.measured?.width ?? 248, h: n.measured?.height ?? 120 })

/**
 * Positions for every card: top to bottom in the order the form is answered, spaced by their real heights.
 * The main run is one column; a question only some answers lead to sits beside it.
 */
export function tidyPositions(nodes: Node[], allEdges: Edge[]): Map<string, { x: number; y: number }> {
  const edges = liveEdges(nodes, allEdges)
  const out = new Map<string, Edge[]>()
  const into = new Map<string, Edge[]>()
  for (const e of edges) {
    out.set(e.source, [...(out.get(e.source) ?? []), e])
    into.set(e.target, [...(into.get(e.target) ?? []), e])
  }

  // Order reached from Start, ignoring any line that would go round in a circle.
  const start = nodes.find((n) => n.type === 'startNode')
  const order: string[] = []
  const state = new Map<string, 'open' | 'done'>()
  const forward = new Set<string>()
  const visit = (id: string) => {
    state.set(id, 'open')
    for (const e of out.get(id) ?? []) {
      if (state.get(e.target) === 'open') continue
      forward.add(e.id)
      if (!state.has(e.target)) visit(e.target)
    }
    state.set(id, 'done')
    order.unshift(id)
  }
  if (start) visit(start.id)

  // Row = longest way there, so a card is always below everything that leads to it.
  const row = new Map<string, number>()
  for (const id of order) {
    const before = (into.get(id) ?? []).filter((e) => forward.has(e.id) && row.has(e.source)).map((e) => row.get(e.source)!)
    row.set(id, before.length ? Math.max(...before) + 1 : 0)
  }

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const rows: string[][] = []
  for (const id of order) (rows[row.get(id)!] ??= []).push(id)

  const pos = new Map<string, { x: number; y: number }>()
  let y = 0
  for (const ids of rows) {
    if (!ids) continue
    // On the main column unless only particular options lead here.
    const isDetour = (id: string) => {
      const inc = into.get(id) ?? []
      return inc.length > 0 && inc.every((e) => (e.sourceHandle ?? OUTPUT) !== OUTPUT)
    }
    const main = ids.filter((id) => !isDetour(id))
    const side = ids.filter(isDetour)
    const place = (id: string, col: number) => pos.set(id, { x: col * COL + (248 - size(byId.get(id)!).w) / 2, y })
    main.forEach((id, i) => place(id, i === 0 ? 0 : -i))
    side.forEach((id, i) => place(id, i + 1))
    y += Math.max(...ids.map((id) => size(byId.get(id)!).h)) + GAP_Y
  }

  // Anything Start doesn't lead to, in its own column on the left.
  let looseY = 0
  for (const n of nodes) {
    if (pos.has(n.id)) continue
    pos.set(n.id, { x: -2 * COL, y: looseY })
    looseY += size(n).h + GAP_Y
  }
  return pos
}

/** How many pairs of cards lie over each other. */
export function overlapCount(nodes: Node[]): number {
  let count = 0
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const A = size(a), B = size(b)
      if (a.position.x < b.position.x + B.w && b.position.x < a.position.x + A.w
        && a.position.y < b.position.y + B.h && b.position.y < a.position.y + A.h) count++
    }
  }
  return count
}
