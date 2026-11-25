import { describe, expect, it } from 'vitest'
import { linkify } from '@/lib/linkify'

const hrefs = (t: string) => linkify(t).flatMap((p) => p.href ?? [])

describe('linkify', () => {
  it('links full, www and bare addresses, without the sentence around them', () => {
    expect(hrefs('CV: https://drive.google.com/file/d/1a_B/view?usp=sharing.')).toEqual(['https://drive.google.com/file/d/1a_B/view?usp=sharing'])
    expect(hrefs('(www.example.com/work) and linkedin.com/in/someone')).toEqual(['https://www.example.com/work', 'https://linkedin.com/in/someone'])
  })
  it('keeps every character of the text', () => {
    const t = 'See https://a.com/b, then\nlinkedin.com/in/x.'
    expect(linkify(t).map((p) => p.text).join('')).toBe(t)
  })
  it('leaves everything else alone, and never makes a script link', () => {
    for (const t of ['None', 'a@b.com', '3/4 year', 'B.Com, 2nd year', 'javascript:alert(1)', '']) expect(hrefs(t)).toEqual([])
  })
})
