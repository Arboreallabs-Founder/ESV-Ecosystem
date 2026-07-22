// Predefined option lists for the Investor/Company form multi-selects (Stage, Sectors,
// Business Types, Thesis Tags). Each still allows a custom "Other" entry via TagSelect,
// so these lists are suggestions, not a hard enum — no DB constraint enforces them.

export const STAGE_OPTIONS = [
  'Pre-Seed', 'Seed', 'Bridge', 'Series A', 'Series B', 'Series C', 'Series D+', 'Growth', 'Pre-IPO',
]

export const SECTOR_OPTIONS = [
  'Fintech', 'SaaS / Enterprise Software', 'E-commerce', 'Consumer / D2C', 'Healthtech', 'Edtech',
  'Agritech', 'Deeptech', 'AI / ML', 'Climate Tech / Cleantech', 'Mobility / EV', 'Logistics & Supply Chain',
  'Foodtech', 'Proptech', 'Gaming', 'Media & Entertainment', 'Cybersecurity', 'Web3 / Crypto',
  'Biotech / Pharma', 'Manufacturing / Industrial', 'Retail', 'Travel & Hospitality', 'HR Tech',
  'Legal Tech', 'InsurTech', 'Space Tech', 'Robotics', 'Renewable Energy', 'B2B Marketplace',
  'Consumer Marketplace', 'Social', 'Devtools / Infra',
]

export const BUSINESS_TYPE_OPTIONS = [
  'B2B', 'B2C', 'B2B2C', 'D2C', 'SaaS', 'Marketplace', 'Platform', 'Aggregator',
  'Deep Tech / Hardware', 'Services', 'Franchise',
]

export const THESIS_TAG_OPTIONS = [
  'AI/ML', 'Quick Commerce', 'Sustainability', 'Tier 2/3 Cities', 'Women-led', 'Rural',
  'Premiumization', 'Vernacular', 'Circular Economy', 'B2B Software', 'Digital-first', 'Omnichannel',
]
