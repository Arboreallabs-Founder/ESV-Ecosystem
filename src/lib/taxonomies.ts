// Predefined option lists for the Investor/Company form multi-selects (Stage, Sectors,
// Business Types, Thesis Tags). Each still allows a custom "Other" entry via TagSelect,
// so these lists are suggestions, not a hard enum — no DB constraint enforces them.

export const STAGE_OPTIONS = [
  'Pre-Seed', 'Seed', 'Bridge', 'Series A', 'Series B', 'Series C', 'Series D+', 'Growth', 'Pre-IPO',
]

/**
 * The ONE sector vocabulary. Companies, investors and portfolio companies all use this list.
 *
 * There were three. The picker said "Fintech", investors said "FinTech", companies said
 * "Health tech" — same idea, three spellings, and nothing matched across them, so an investor list
 * built for a defence deal found no defence funds. Free text is what let them diverge: the picker
 * has always existed, but it accepted anything typed past it.
 *
 * Compact style ("FinTech", "HealthTech") rather than spaced, because 85 portfolio rows and every
 * imported fund exclusion are already written that way and rewriting them is the larger risk.
 *
 * Adding a sector: add it here, and add any old spelling to ALIASES in src/lib/sector-aliases.ts so
 * existing records keep resolving.
 */
export const SECTOR_OPTIONS = [
  'Agnostic',
  'AgriTech', 'AI/ML', 'AR/VR', 'B2B', 'Beauty', 'BioTech', 'ClimateTech', 'Consumer',
  'Cybersecurity', 'D2C', 'DeepTech', 'Defence', 'Drones', 'E-commerce', 'EdTech', 'Energy',
  'EV & Mobility', 'Fashion', 'FinTech', 'FoodTech', 'Gaming', 'Hardware', 'HealthTech', 'HRTech',
  'Infrastructure', 'IoT', 'LegalTech', 'Logistics', 'Manufacturing', 'Marketplace', 'Media',
  'Real Estate', 'Retail', 'Robotics', 'SaaS', 'SpaceTech', 'Sports', 'Travel', 'Web3',
]

export const BUSINESS_TYPE_OPTIONS = [
  'B2B', 'B2C', 'B2B2C', 'D2C', 'SaaS', 'Marketplace', 'Platform', 'Aggregator',
  'Deep Tech / Hardware', 'Services', 'Franchise',
]

export const THESIS_TAG_OPTIONS = [
  'AI/ML', 'Quick Commerce', 'Sustainability', 'Tier 2/3 Cities', 'Women-led', 'Rural',
  'Premiumization', 'Vernacular', 'Circular Economy', 'B2B Software', 'Digital-first', 'Omnichannel',
]
