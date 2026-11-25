import { describe, expect, it } from 'vitest'
import { websiteAnswerProblem } from '@/lib/form-validation'

const email = { answer_type: 'short_text', contact_field: 'email' }
const phone = { answer_type: 'short_text', contact_field: 'phone' }
const text = { answer_type: 'short_text', contact_field: null }

describe('websiteAnswerProblem', () => {
  it('requires an answer', () => {
    expect(websiteAnswerProblem('  ', text)).toMatch(/answer this question/)
    expect(websiteAnswerProblem('', { answer_type: 'mcq', contact_field: null })).toMatch(/choose an option/)
    expect(websiteAnswerProblem('None', text)).toBeNull()
  })

  it('checks email', () => {
    expect(websiteAnswerProblem('a@b.co', email)).toBeNull()
    for (const bad of ['a', 'a@b', 'a b@c.com', '@c.com', 'a@b.c']) expect(websiteAnswerProblem(bad, email)).toMatch(/valid email/)
  })

  it('accepts international phone numbers and asks for a missing country code', () => {
    for (const good of ['+91 98765 43210', '+971 50 123 4567', '+65 9123 4567', '0044 20 7946 0958', '919876543210', '+1 (415) 555-0100']) {
      expect(websiteAnswerProblem(good, phone)).toBeNull()
    }
    expect(websiteAnswerProblem('9876543210', phone)).toMatch(/country code/)
    for (const bad of ['12', 'call me', '+91 98765x43210']) expect(websiteAnswerProblem(bad, phone)).toMatch(/valid phone/)
  })
})
