import { describe, expect, it } from 'vitest'
import { normalizeCompanyName, nameSimilarity, findSimilar } from '@/lib/company-match'

const companies = [
  { id: '1', name: 'Zeta Labs', legal_name: 'Zeta Labs Private Limited' },
  { id: '2', name: 'Acme Technologies', legal_name: null },
  { id: '3', name: 'Quantum Foods', legal_name: null },
  { id: '4', name: 'Labs', legal_name: null },
]

describe('normalizeCompanyName', () => {
  it('drops case, punctuation and legal/filler suffixes', () => {
    expect(normalizeCompanyName('Acme Technologies Pvt. Ltd.')).toBe('acme')
    expect(normalizeCompanyName('ZETA-LABS')).toBe('zeta')
    expect(normalizeCompanyName('Labs')).toBe('labs') // never stripped to nothing
  })
})

describe('nameSimilarity', () => {
  it('is 1 for the same company written differently', () => {
    expect(nameSimilarity('Acme Technologies', 'ACME Pvt Ltd')).toBe(1)
  })
  it('is high for a typo and low for unrelated names', () => {
    expect(nameSimilarity('Zetta Labs', 'Zeta Labs')).toBeGreaterThan(0.75)
    expect(nameSimilarity('Quantum Foods', 'Zeta Labs')).toBeLessThan(0.3)
  })
})

describe('findSimilar', () => {
  it('finds exact, suffix and typo duplicates, best first', () => {
    const r = findSimilar('Zetta Labs Pvt Ltd', companies)
    expect(r[0]).toMatchObject({ id: '1' })
    expect(findSimilar('acme', companies)[0]).toMatchObject({ id: '2', reason: 'exact', score: 1 })
  })
  it('matches on legal name too', () => {
    expect(findSimilar('Zeta Labs Private Limited', companies)[0]?.id).toBe('1')
  })
  it('returns nothing for a genuinely new company', () => {
    expect(findSimilar('Brightwater Analytics', companies)).toEqual([])
  })
})
