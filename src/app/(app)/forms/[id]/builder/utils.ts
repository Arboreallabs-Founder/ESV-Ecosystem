import React from 'react'

// Parse **bold** and *italic* markdown into React spans
export function renderFormattedText(text: string): React.ReactNode {
  if (!text) return null
  const parts: React.ReactNode[] = []
  // Match **bold** or *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[0].startsWith('**')) {
      parts.push(React.createElement('strong', { key: key++ }, match[2]))
    } else {
      parts.push(React.createElement('em', { key: key++ }, match[3]))
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 ? parts[0] : React.createElement(React.Fragment, null, ...parts)
}

export function wrapSelection(
  text: string,
  selStart: number,
  selEnd: number,
  marker: '**' | '*',
): { newText: string; newSelStart: number; newSelEnd: number } {
  const selected = text.slice(selStart, selEnd)
  const wrapped = `${marker}${selected}${marker}`
  const newText = text.slice(0, selStart) + wrapped + text.slice(selEnd)
  return {
    newText,
    newSelStart: selStart + marker.length,
    newSelEnd: selEnd + marker.length,
  }
}

export function generateId(): string {
  return crypto.randomUUID()
}
