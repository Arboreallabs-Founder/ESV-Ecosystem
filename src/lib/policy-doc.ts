// Typesetting for HR policy bodies.
//
// hr_policies.body is a plain TEXT column and the editor is a plain <textarea> — deliberately, so
// HR can paste a policy in without learning an editor. This parses a small, fixed subset of
// Markdown out of that text so the reader can lay it out as a document instead of one grey wall
// of pre-wrapped characters.
//
// The subset is closed on purpose: headings (##/###/####), bullet and numbered lists with one
// level of nesting, pipe tables, > callouts, **bold**. Anything it does not recognise falls
// through as a paragraph, so a policy written before this existed renders exactly as it always
// did — just with better spacing.

export type PolicySpan = { text: string; bold: boolean }

export type PolicyListItem = {
  spans: PolicySpan[]
  sub: { ordered: boolean; items: PolicyListItem[] } | null
}

export type PolicyBlock =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string; id: string }
  | { kind: 'para'; spans: PolicySpan[] }
  | { kind: 'callout'; spans: PolicySpan[] }
  | { kind: 'list'; ordered: boolean; items: PolicyListItem[] }
  | { kind: 'table'; head: string[]; rows: string[][] }

const HEADING = /^(#{2,4})\s+(.*)$/
const BULLET = /^(\s*)[-*•●○o]\s+(.+)$/
const NUMBERED = /^(\s*)\d+[.)]\s+(.+)$/
const CALLOUT = /^>\s?(.*)$/
const TABLE_ROW = /^\s*\|(.*)\|\s*$/
const TABLE_RULE = /^:?-{2,}:?$/

// Bold is the only inline mark. An unclosed ** just leaves the tail bold, which is what a writer
// who typed one asterisk pair meant anyway.
function parseSpans(raw: string): PolicySpan[] {
  const spans: PolicySpan[] = []
  let bold = false
  for (const chunk of raw.split('**')) {
    if (chunk) spans.push({ text: chunk, bold })
    bold = !bold
  }
  return spans.length > 0 ? spans : [{ text: '', bold: false }]
}

function slugify(text: string, used: Set<string>): string {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section'
  let id = base
  let n = 2
  while (used.has(id)) id = `${base}-${n++}`
  used.add(id)
  return id
}

function splitRow(line: string): string[] {
  const inner = line.match(TABLE_ROW)?.[1] ?? ''
  return inner.split('|').map((c) => c.trim())
}

export function parsePolicy(body: string): PolicyBlock[] {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const blocks: PolicyBlock[] = []
  const usedIds = new Set<string>()
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    const heading = line.match(HEADING)
    if (heading) {
      const text = heading[2].trim()
      blocks.push({ kind: 'heading', level: heading[1].length as 2 | 3 | 4, text, id: slugify(text, usedIds) })
      i++
      continue
    }

    // Tables: a run of pipe rows. The first is the header, an all-dashes second row is the
    // separator convention and is dropped.
    if (TABLE_ROW.test(line)) {
      const rows: string[][] = []
      while (i < lines.length && TABLE_ROW.test(lines[i])) { rows.push(splitRow(lines[i])); i++ }
      const head = rows.shift() ?? []
      if (rows.length > 0 && rows[0].every((c) => TABLE_RULE.test(c))) rows.shift()
      blocks.push({ kind: 'table', head, rows })
      continue
    }

    const callout = line.match(CALLOUT)
    if (callout) {
      const parts = [callout[1]]
      i++
      while (i < lines.length && CALLOUT.test(lines[i])) { parts.push(lines[i].match(CALLOUT)![1]); i++ }
      blocks.push({ kind: 'callout', spans: parseSpans(parts.join(' ').trim()) })
      continue
    }

    const listStart = line.match(BULLET) ?? line.match(NUMBERED)
    if (listStart && listStart[1].length < 2) {
      const ordered = NUMBERED.test(line)
      const items: PolicyListItem[] = []
      while (i < lines.length) {
        const bullet = lines[i].match(BULLET)
        const numbered = lines[i].match(NUMBERED)
        const match = bullet ?? numbered
        if (!match) break
        const indented = match[1].length >= 2
        if (!indented && !!numbered !== ordered) break
        if (indented) {
          // Nested under the item above it. One level only — a policy that needs three is a
          // policy that needs splitting.
          const parent = items[items.length - 1]
          if (!parent) break
          if (!parent.sub) parent.sub = { ordered: !!numbered, items: [] }
          parent.sub.items.push({ spans: parseSpans(match[2].trim()), sub: null })
        } else {
          items.push({ spans: parseSpans(match[2].trim()), sub: null })
        }
        i++
      }
      blocks.push({ kind: 'list', ordered, items })
      continue
    }

    // Paragraph: everything up to the next blank line or block opener, rejoined so hard-wrapped
    // source text reflows instead of breaking mid-sentence.
    const para: string[] = []
    while (i < lines.length) {
      const next = lines[i]
      if (!next.trim()) break
      if (para.length > 0 && (HEADING.test(next) || TABLE_ROW.test(next) || CALLOUT.test(next) || BULLET.test(next) || NUMBERED.test(next))) break
      para.push(next.trim())
      i++
    }
    if (para.length > 0) blocks.push({ kind: 'para', spans: parseSpans(para.join(' ')) })
  }

  return blocks
}

export type PolicyOutlineEntry = { id: string; text: string; level: 2 | 3 }

// Contents rail: top two heading levels only. A rail listing every #### is a second document.
export function policyOutline(blocks: PolicyBlock[]): PolicyOutlineEntry[] {
  return blocks
    .filter((b): b is Extract<PolicyBlock, { kind: 'heading' }> => b.kind === 'heading' && b.level < 4)
    .map((b) => ({ id: b.id, text: b.text, level: b.level as 2 | 3 }))
}

// The card preview — the first real prose in the policy, not a heading or a table cell.
export function policyExcerpt(blocks: PolicyBlock[]): string {
  const para = blocks.find((b) => b.kind === 'para')
  if (!para || para.kind !== 'para') return ''
  return para.spans.map((s) => s.text).join('')
}
