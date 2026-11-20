/**
 * Fuzzy company-name matching, used to warn before creating a duplicate profile.
 *
 * Deliberately simple and explainable: names are normalised (case, punctuation, legal suffixes like
 * "Pvt Ltd" and filler like "Technologies"), then compared by bigram (Dice) similarity, with exact
 * and contains-matches ranked first. It runs over the org's own company list, which is small enough
 * to hold in memory — no database extension needed.
 */

const SUFFIXES = [
  'private limited', 'pvt ltd', 'pvt. ltd', 'pvt', 'limited', 'ltd', 'llp', 'llc', 'inc', 'incorporated',
  'corp', 'corporation', 'co', 'company', 'technologies', 'technology', 'tech', 'labs', 'solutions',
  'ventures', 'india', 'global', 'ai',
]

export function normalizeCompanyName(name: string): string {
  let s = name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  s = s.replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
  // Strip trailing legal/filler words repeatedly ("Acme Technologies Pvt Ltd" → "acme"), but never
  // down to nothing — "Labs" alone stays "labs".
  let changed = true
  while (changed) {
    changed = false
    for (const suf of SUFFIXES) {
      if (s.endsWith(` ${suf}`) && s.length > suf.length + 1) {
        s = s.slice(0, -(suf.length + 1)).trim()
        changed = true
      }
    }
  }
  return s
}

function bigrams(s: string): string[] {
  const t = s.replace(/ /g, '')
  if (t.length < 2) return [t]
  const out: string[] = []
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2))
  return out
}

/** Dice coefficient over character bigrams of the normalised names, 0..1. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeCompanyName(a)
  const nb = normalizeCompanyName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const A = bigrams(na)
  const B = bigrams(nb)
  const counts = new Map<string, number>()
  for (const g of A) counts.set(g, (counts.get(g) ?? 0) + 1)
  let overlap = 0
  for (const g of B) {
    const c = counts.get(g) ?? 0
    if (c > 0) { overlap++; counts.set(g, c - 1) }
  }
  return (2 * overlap) / (A.length + B.length)
}

export type CompanyMatch = { id: string; name: string; legal_name: string | null; score: number; reason: 'exact' | 'contains' | 'similar' }

/**
 * Candidates that look like `name`, best first. A threshold of 0.75 catches typos and suffix
 * variants ("Zeta Labs" / "Zetta Labs Pvt Ltd") without flagging every company that shares a word.
 */
export function findSimilar(
  name: string,
  companies: Array<{ id: string; name: string; legal_name?: string | null }>,
  threshold = 0.75,
  limit = 5,
): CompanyMatch[] {
  const target = normalizeCompanyName(name)
  if (!target) return []
  const out: CompanyMatch[] = []
  for (const c of companies) {
    let best: CompanyMatch | null = null
    for (const candidate of [c.name, c.legal_name].filter((x): x is string => !!x)) {
      const n = normalizeCompanyName(candidate)
      if (!n) continue
      let m: CompanyMatch | null = null
      if (n === target) m = { id: c.id, name: c.name, legal_name: c.legal_name ?? null, score: 1, reason: 'exact' }
      else if (target.length >= 4 && n.length >= 4 && (n.includes(target) || target.includes(n))) {
        m = { id: c.id, name: c.name, legal_name: c.legal_name ?? null, score: 0.9, reason: 'contains' }
      } else {
        const score = nameSimilarity(target, n)
        if (score >= threshold) m = { id: c.id, name: c.name, legal_name: c.legal_name ?? null, score: Math.round(score * 100) / 100, reason: 'similar' }
      }
      if (m && (!best || m.score > best.score)) best = m
    }
    if (best) out.push(best)
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}
