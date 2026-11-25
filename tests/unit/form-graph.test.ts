import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { condenseEdges, liveEdges, overlapCount, tidyPositions, validateGraph } from '@/app/(app)/forms/[id]/builder/graph'

const q = (id: string, opts?: string[], h = 100): Node => ({
  id, type: 'questionNode', position: { x: 0, y: 0 }, measured: { width: 248, height: h },
  data: { questionText: id, answerType: opts ? 'mcq' : 'short_text', options: (opts ?? []).map((l, i) => ({ id: `${id}-${l}`, label: l, position: i })) },
})
const start: Node = { id: 'start', type: 'startNode', position: { x: 0, y: 0 }, measured: { width: 84, height: 84 }, data: {} }
const end: Node = { id: 'end', type: 'endNode', position: { x: 0, y: 0 }, measured: { width: 84, height: 84 }, data: { subtype: 'success' } }
let n = 0
const e = (source: string, target: string, sourceHandle = 'output'): Edge => ({ id: `e${n++}`, source, target, sourceHandle })

// type (A, B, C): C → name → raised; A and B → raised → end
const nodes = [start, q('type', ['A', 'B', 'C'], 300), q('name'), q('raised', ['Yes', 'No']), end]
const perOption = [
  e('start', 'type'), e('type', 'raised', 'type-A'), e('type', 'raised', 'type-B'), e('type', 'name', 'type-C'),
  e('name', 'raised'), e('raised', 'end'),
]

describe('validateGraph', () => {
  it('accepts one line for all options, and needs no Not Eligible end', () => {
    expect(validateGraph(nodes, perOption)).toBeNull()
  })
  it('names the option that leads nowhere', () => {
    expect(validateGraph(nodes, perOption.filter((x) => x.sourceHandle !== 'type-B'))).toMatch(/"B" leads nowhere/)
  })
  it('refuses two lines from one output, and ignores lines from deleted options', () => {
    expect(validateGraph(nodes, [...perOption, e('raised', 'name')])).toMatch(/multiple outgoing/)
    expect(liveEdges(nodes, [...perOption, e('type', 'end', 'gone')])).toHaveLength(perOption.length)
    expect(validateGraph(nodes, [...perOption, e('type', 'end', 'gone'), e('name', 'end', 'gone')])).toBeNull()
  })
})

describe('condenseEdges', () => {
  it('keeps the exceptions and says the rest once', () => {
    const out = condenseEdges(nodes, perOption, () => 'new').filter((x) => x.source === 'type')
    expect(out.map((x) => [x.sourceHandle, x.target]).sort()).toEqual([['output', 'raised'], ['type-C', 'name']])
  })
  it('leaves a question with an unconnected option alone', () => {
    const some = perOption.filter((x) => x.sourceHandle !== 'type-C')
    expect(condenseEdges(nodes, some, () => 'new')).toHaveLength(some.length)
  })
})

describe('tidyPositions', () => {
  const edges = condenseEdges(nodes, perOption, () => 'new')
  const place = (es: Edge[], ns = nodes) => { const p = tidyPositions(ns, es); return ns.map((x) => ({ ...x, position: p.get(x.id)! })) }
  it('never overlaps, runs downwards, and puts the detour beside the main column', () => {
    const out = place(edges)
    expect(overlapCount(nodes)).toBeGreaterThan(0)
    expect(overlapCount(out)).toBe(0)
    const y = Object.fromEntries(out.map((x) => [x.id, x.position.y]))
    expect(y.start < y.type && y.type < y.name && y.name < y.raised && y.raised < y.end).toBe(true)
    expect(y.name - y.type).toBe(370)
    const x = Object.fromEntries(out.map((o) => [o.id, o.position.x]))
    expect(x.name).toBeGreaterThan(x.type)
    expect(x.raised).toBe(x.type)
  })
  it('copes with circles and cards nothing leads to', () => {
    const out = place([...edges, e('name', 'type', 'loop')], [...nodes, q('loose1'), q('loose2')])
    expect(overlapCount(out)).toBe(0)
    const loop = [start, q('a', ['Again', 'Go']), q('b'), end]
    const p = tidyPositions(loop, [e('start', 'a'), e('a', 'b', 'a-Go'), e('a', 'a', 'a-Again'), e('b', 'a')])
    expect(p.size).toBe(4)
  })
})
