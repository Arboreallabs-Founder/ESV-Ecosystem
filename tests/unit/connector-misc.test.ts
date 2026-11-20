import { describe, expect, it } from 'vitest'
import { safeNext } from '@/lib/safe-next'
import { connectorClientName } from '@/lib/mcp/context'
import { diff } from '@/lib/mcp/tools/shared'

describe('safeNext', () => {
  it('allows same-site paths only', () => {
    expect(safeNext('/oauth/consent?authorization_id=x')).toBe('/oauth/consent?authorization_id=x')
    expect(safeNext('//evil.com')).toBeNull()
    expect(safeNext('/\\evil.com')).toBeNull()
    expect(safeNext('https://evil.com')).toBeNull()
    expect(safeNext('/ok\nSet-Cookie: x')).toBeNull()
  })
})

describe('connectorClientName', () => {
  it('names the assistant from its user agent', () => {
    expect(connectorClientName('Claude-User/1.0', null)).toBe('Claude')
    expect(connectorClientName('openai-mcp/1.0', null)).toBe('ChatGPT')
    expect(connectorClientName('curl/8', 'abcdef1234')).toBe('client abcdef12')
  })
})

describe('diff', () => {
  it('reports only changed keys among those asked for', () => {
    expect(diff({ a: 1, b: [1], c: 'x' }, { a: 2, b: [1], c: 'x' }, ['a', 'b'])).toEqual({ a: { before: 1, after: 2 } })
    expect(diff({ a: null }, {}, ['a'])).toEqual({})
  })
})
