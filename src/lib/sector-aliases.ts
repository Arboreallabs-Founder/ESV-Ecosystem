/**
 * Translating company sector labels into the investor sector vocabulary.
 *
 * These two vocabularies grew separately and never met. Companies are tagged with 25 labels
 * ("FMCG", "Telecom Infrastructure", "SaaS / Enterprise Software"), investors with 52 ("Consumer",
 * "Infrastructure", "SaaS"), and only 8 overlap. The result was an investor-list page that offered
 * nothing but sector-agnostic funds on most deals, with no indication why: the deal HAD tags, they
 * were simply in a different language.
 *
 * This resolves at match time rather than rewriting either side. Renaming company tags would fight
 * whatever the companies module expects, and rewriting investor tags would break the 85 portfolio
 * rows and the exclusions that were just imported against them. A translation layer is reversible;
 * a migration over both vocabularies is not.
 *
 * One label can map to several: "FMCG" is Consumer AND Retail, and a fund tagged either is a fair
 * match for an FMCG company.
 */

/** Ignore case, spaces, ampersands and slashes — "Health tech" and "HealthTech" are one thing. */
export const canonSector = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const ALIASES: Record<string, string[]> = {
  // Spelling. The one that stings: an entire defence deal matched nothing over a single letter.
  defense: ['Defence'],
  defence: ['Defence'],

  // Consumer goods. The company side thinks in FMCG categories, the investor side in tech verbs.
  fmcg: ['Consumer', 'Retail'],
  food: ['FoodTech'],
  beverages: ['FoodTech', 'Consumer'],
  fnb: ['FoodTech'],
  consumergoods: ['Consumer'],

  // Software.
  saasenterprisesoftware: ['SaaS', 'B2B'],
  enterprisesoftware: ['SaaS', 'B2B'],
  b2bservices: ['B2B'],
  voiceaispeechtotext: ['AI/ML'],
  voiceai: ['AI/ML'],
  speechtotext: ['AI/ML'],

  // Infrastructure. "Telecom Infrastructure" is not a sector any fund lists, but Infrastructure is.
  telecominfrastructure: ['Infrastructure'],
  digitalinfrastructure: ['Infrastructure'],
  industrialproducts: ['Manufacturing'],

  // Financial services.
  alternativelending: ['FinTech'],
  lending: ['FinTech'],
  parametricinsurance: ['FinTech'],
  insurance: ['FinTech'],
  insurtech: ['FinTech'],

  // Climate and energy.
  climate: ['ClimateTech'],
  renewableenergy: ['Energy', 'ClimateTech'],
  cleanenergy: ['Energy', 'ClimateTech'],
  solar: ['Energy', 'ClimateTech'],

  // Movement.
  mobility: ['EV & Mobility'],
  evmobility: ['EV & Mobility'],
  lastmiledelivery: ['Logistics'],
  supplychain: ['Logistics'],
  warehousing: ['Logistics'],

  // People.
  staffingfacilitymanagement: ['HRTech'],
  staffing: ['HRTech'],
  recruitment: ['HRTech'],

  // Common near-misses between the two lists.
  healthcare: ['HealthTech'],
  pharma: ['HealthTech', 'BioTech'],
  ecommerce: ['E-commerce'],
  d2c: ['D2C', 'Consumer'],
  edtech: ['EdTech'],
  agritech: ['AgriTech'],
  agriculture: ['AgriTech'],
  deeptech: ['DeepTech'],
  spacetech: ['SpaceTech'],
  proptech: ['Real Estate'],
  realestate: ['Real Estate'],
}

/**
 * Company sector labels -> investor vocabulary.
 *
 * Anything already in the investor vocabulary passes through untouched; anything with an alias is
 * translated; anything else is returned as unresolved so the UI can say WHICH tag it could not use
 * rather than silently showing an empty list.
 */
export function resolveSectors(
  companySectors: string[],
  investorVocabulary: string[],
): { resolved: string[]; unresolved: string[] } {
  const vocab = new Map(investorVocabulary.map((v) => [canonSector(v), v]))
  const resolved = new Set<string>()
  const unresolved: string[] = []

  for (const raw of companySectors) {
    const key = canonSector(raw)
    const direct = vocab.get(key)
    if (direct) { resolved.add(direct); continue }

    const aliased = ALIASES[key]
    if (aliased?.length) {
      // Only keep an alias the investor side actually uses — mapping to a tag no fund carries
      // would produce a match that can never fire.
      const usable = aliased.filter((a) => vocab.has(canonSector(a)))
      if (usable.length) {
        for (const a of usable) resolved.add(vocab.get(canonSector(a))!)
        continue
      }
    }
    unresolved.push(raw)
  }
  return { resolved: [...resolved], unresolved }
}
