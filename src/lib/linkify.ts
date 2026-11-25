/** Splits text somebody typed into plain parts and web links, so a CV or profile link can be opened. */
const LINK = /(?:https?:\/\/|www\.)\S+|(?<![@\w.:/-])(?:[a-z0-9-]+\.)+[a-z]{2,}\/\S+/gi

export type TextPart = { text: string; href?: string }

export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = []
  let at = 0
  for (const m of text.matchAll(LINK)) {
    // A full stop or bracket that ends the sentence isn't part of the link.
    const link = m[0].replace(/[.,;:!?)\]}'">]+$/, '')
    if (m.index > at) parts.push({ text: text.slice(at, m.index) })
    parts.push({ text: link, href: /^https?:\/\//i.test(link) ? link : `https://${link}` })
    at = m.index + link.length
  }
  if (at < text.length) parts.push({ text: text.slice(at) })
  return parts
}
