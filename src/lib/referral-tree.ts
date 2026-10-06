import type { PartnerReferralTreeNode } from './types'

/**
 * Nesting the referral tree, and the arithmetic of a round.
 *
 * get_partner_referral_tree returns edges — one flat row per investor, carrying its parent — because
 * nesting in SQL means either a jsonb recursion nobody can read or a bespoke composite type. The
 * layout has to walk the list anyway, so it nests here.
 */

export type ReferralTreeNode = PartnerReferralTreeNode & {
  children: ReferralTreeNode[]
  /** This investor plus everyone below them. What the partner is actually credited for. */
  subtree_invested: number
  subtree_count: number
}

/**
 * Edges in, roots out.
 *
 * Rows whose parent is missing from the list are promoted to the top rather than dropped. The
 * function returns one partner's subtree, so a parent can genuinely be absent — an investor
 * re-rooted onto another partner mid-chain — and silently losing their whole branch would
 * understate what the partner is owed, which is the one thing this view must not do.
 */
export function buildReferralTree(rows: PartnerReferralTreeNode[]): ReferralTreeNode[] {
  const byId = new Map<string, ReferralTreeNode>()
  for (const r of rows) {
    byId.set(r.investor_id, { ...r, children: [], subtree_invested: 0, subtree_count: 0 })
  }

  const roots: ReferralTreeNode[] = []
  for (const node of byId.values()) {
    const parent = node.parent_investor_id ? byId.get(node.parent_investor_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  // Depth-first from each root, children before parents, so a parent's totals are the sum of
  // branches already computed. Iterative: a chain is capped at 32 by the database, but this also
  // runs on whatever a future import produces.
  const order: ReferralTreeNode[] = []
  const stack = [...roots]
  while (stack.length) {
    const n = stack.pop()!
    order.push(n)
    for (const c of n.children) stack.push(c)
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i]
    n.children.sort((a, b) => a.investor_name.localeCompare(b.investor_name))
    n.subtree_invested = n.invested_total + n.children.reduce((s, c) => s + c.subtree_invested, 0)
    n.subtree_count = 1 + n.children.reduce((s, c) => s + c.subtree_count, 0)
  }

  roots.sort((a, b) => a.investor_name.localeCompare(b.investor_name))
  return roots
}

/** How many investors are in the tree, and how deep it goes. For the summary line above it. */
export function treeStats(roots: ReferralTreeNode[]): { total: number; maxDepth: number; invested: number } {
  let total = 0
  let maxDepth = 0
  let invested = 0
  const walk = (n: ReferralTreeNode) => {
    total += 1
    invested += n.invested_total
    if (n.depth > maxDepth) maxDepth = n.depth
    n.children.forEach(walk)
  }
  roots.forEach(walk)
  return { total, maxDepth, invested }
}

/**
 * What is still open on a round.
 *
 * Derived, never stored: a stored "remaining" disagrees with the investor rows the moment one is
 * edited, and the disagreement is invisible. Null whenever the round total is unknown — showing
 * "open: ₹30Cr" computed from a total nobody has entered would be inventing the number.
 *
 * Clamped at zero. An over-subscribed round is a real and good state; a negative amount open is
 * not a sentence anyone should read on a deal page.
 */
export function openAmount(
  totalRaise: number | null | undefined,
  externalRaised: number | null | undefined,
  committedThroughUs: number | null | undefined,
): number | null {
  if (totalRaise == null) return null
  const taken = (externalRaised ?? 0) + (committedThroughUs ?? 0)
  return Math.max(0, totalRaise - taken)
}

/** The three slices of a round, as percentages of the whole, for the progress bar. */
export function raiseBreakdown(
  totalRaise: number | null | undefined,
  externalRaised: number | null | undefined,
  committedThroughUs: number | null | undefined,
): { externalPct: number; committedPct: number; openPct: number } | null {
  if (totalRaise == null || totalRaise <= 0) return null
  const pct = (n: number) => Math.max(0, Math.min(100, (n / totalRaise) * 100))
  const externalPct = pct(externalRaised ?? 0)
  // Capped against what external already took, so an over-subscribed round fills the bar rather
  // than overflowing it.
  const committedPct = Math.min(pct(committedThroughUs ?? 0), 100 - externalPct)
  return { externalPct, committedPct, openPct: 100 - externalPct - committedPct }
}
