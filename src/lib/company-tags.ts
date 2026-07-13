// Keyword extraction for company meta-tags. Deterministic dictionary approach (no LLM): scan the
// company's text against curated keyword patterns and emit canonical theme tags. These broaden
// investor matching beyond the primary sector — e.g. a D2C brand that sells via quick-commerce
// gets a "Quick Commerce" tag, so investors who back quick-commerce surface as synergetic.

// canonical tag → trigger keywords (matched case-insensitively; short/ambiguous ones use word boundaries).
const TAG_KEYWORDS: Record<string, string[]> = {
  'Quick Commerce': ['quick commerce', 'quick-commerce', 'qcomm', 'q-comm', 'q commerce', 'blinkit', 'zepto', 'instamart', 'swiggy instamart', '10-minute', '10 minute', 'dark store', 'dark-store'],
  'D2C': ['d2c', 'direct-to-consumer', 'direct to consumer'],
  'AI/ML': ['artificial intelligence', 'machine learning', 'deep learning', 'generative ai', 'genai', 'llm', 'computer vision', 'nlp'],
  'SaaS': ['saas', 'software-as-a-service', 'software as a service'],
  'Marketplace': ['marketplace', 'aggregator', 'two-sided', 'platform connecting'],
  'Subscription': ['subscription', 'recurring revenue', 'membership model'],
  'Fintech': ['fintech', 'payments', 'lending', 'neobank', 'wealthtech', 'insurtech', 'upi', 'credit'],
  'B2B': ['b2b', 'business-to-business', 'enterprise software', 'wholesale'],
  'B2C': ['b2c', 'business-to-consumer', 'consumer app'],
  'Healthtech': ['healthtech', 'health tech', 'healthcare', 'medtech', 'pharma', 'clinical', 'diagnostic', 'telehealth', 'wellness'],
  'Climate': ['climate', 'sustainability', 'clean energy', 'cleantech', 'carbon', 'renewable', 'solar', 'ev', 'electric vehicle'],
  'Deep Tech': ['deep tech', 'deeptech', 'robotics', 'semiconductor', 'quantum', 'drone', 'space tech', 'spacetech'],
  'Agritech': ['agritech', 'agri-tech', 'agriculture', 'farming', 'farmer', 'agri supply'],
  'Edtech': ['edtech', 'ed-tech', 'e-learning', 'upskilling', 'learning platform'],
  'Logistics': ['logistics', 'supply chain', 'last-mile', 'last mile', 'freight', 'warehousing', 'fulfilment', 'fulfillment'],
  'FMCG': ['fmcg', 'cpg', 'consumer packaged goods', 'packaged food', 'beverage', 'snack'],
  'Mobility': ['mobility', 'ride-hailing', 'ride hailing', 'micro-mobility', 'fleet'],
  'Gaming': ['gaming', 'esports', 'game studio'],
  'Web3': ['web3', 'blockchain', 'crypto', 'defi', 'nft'],
  'Marketplace Enablement': ['seller enablement', 'brand enablement', 'commerce enablement'],
}

// Short/ambiguous tokens matched with word boundaries to avoid false positives (e.g. "ai" in "brain").
const WORD_BOUNDARY = new Set(['d2c', 'b2b', 'b2c', 'saas', 'ev', 'nlp', 'upi', 'llm', 'genai', 'cpg', 'fmcg', 'defi', 'nft', 'web3'])

function matches(haystack: string, keyword: string): boolean {
  if (WORD_BOUNDARY.has(keyword)) {
    return new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i').test(haystack)
  }
  return haystack.includes(keyword)
}

/** Extract canonical meta-tags from free text. */
export function extractMetaTags(...texts: Array<string | null | undefined>): string[] {
  const hay = texts.filter(Boolean).join(' \n ').toLowerCase()
  if (!hay.trim()) return []
  const out: string[] = []
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (keywords.some((k) => matches(hay, k))) out.push(tag)
  }
  return out
}

/** All canonical tags (for a tag picker, if needed). */
export const ALL_META_TAGS = Object.keys(TAG_KEYWORDS)
