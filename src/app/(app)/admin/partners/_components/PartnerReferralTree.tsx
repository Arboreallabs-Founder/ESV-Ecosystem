'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { buildReferralTree, treeStats, type ReferralTreeNode } from '@/lib/referral-tree'
import { formatMoneyShort } from '@/lib/format-money'
import type { PartnerReferralTreeNode } from '@/lib/types'
import styles from './referral-tree.module.css'

/**
 * The referral tree, drawn.
 *
 * Nested lists with CSS connectors rather than a laid-out diagram. A tree of investors is a tree of
 * names of wildly different lengths, growing sideways as chains deepen — an SVG canvas would need
 * its own layout pass and would still have to reflow on a phone, where this reads as an indented
 * list and stays legible. @xyflow/react is not an option here: it is confined to the form builder
 * (CLAUDE.md), and this is the kind of second use that quietly makes it a dependency everywhere.
 *
 * Every node carries two numbers: what that investor put in, and what their whole branch did. The
 * branch total is the one that matters for a fee — ESV pays the root partner gross of everything
 * below them.
 */
export default function PartnerReferralTree({
  partnerName,
  rows,
  /** Internal viewers get links into the fund records; a partner cannot open those pages. */
  linkInvestors = false,
}: {
  partnerName: string
  rows: PartnerReferralTreeNode[]
  linkInvestors?: boolean
}) {
  const roots = useMemo(() => buildReferralTree(rows), [rows])
  const stats = useMemo(() => treeStats(roots), [roots])

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No investors roll up to {partnerName} yet.</p>
        <p className={styles.emptyBody}>
          Once a referral is accepted and signed off, it appears here — along with anyone those
          investors go on to introduce.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <Stat label="In the tree" value={String(stats.total)} />
        <Stat label="Deepest chain" value={stats.maxDepth === 1 ? 'Direct only' : `${stats.maxDepth} levels`} />
        <Stat label="Invested across the tree" value={formatMoneyShort(stats.invested) ?? '—'} />
      </div>

      <div className={styles.tree} aria-label={`Investors introduced through ${partnerName}`}>
        <div className={styles.rootNode}>
          <span className={styles.rootBadge}>Partner</span>
          <span className={styles.rootName}>{partnerName}</span>
        </div>
        <ul className={styles.branch}>
          {roots.map((n) => (
            <TreeNode key={n.investor_id} node={n} linkInvestors={linkInvestors} />
          ))}
        </ul>
      </div>

      <p className={styles.footnote}>
        ESV pays {partnerName} gross on everything in this tree, however many hops away it is. What
        happens between {partnerName} and the people below them is their own arrangement and is not
        tracked here.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

function TreeNode({ node, linkInvestors }: { node: ReferralTreeNode; linkInvestors: boolean }) {
  // Collapsed by default below the second level: a partner with forty funds should open to
  // something readable, not to the whole forest.
  const [open, setOpen] = useState(node.depth < 2)
  const hasChildren = node.children.length > 0

  const name = linkInvestors
    ? <Link href={`/investors/${node.investor_id}`} className={styles.nameLink}>{node.investor_name}</Link>
    : <span className={styles.name}>{node.investor_name}</span>

  return (
    <li className={styles.node}>
      <div className={styles.card}>
        <div className={styles.cardMain}>
          {hasChildren ? (
            <button
              type="button"
              className={styles.toggle}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? `Collapse ${node.investor_name}` : `Expand ${node.investor_name}`}
            >
              {open ? '−' : '+'}
            </button>
          ) : <span className={styles.toggleSpacer} aria-hidden="true" />}
          {name}
          {node.depth === 1 && <span className={styles.directTag}>Direct</span>}
        </div>

        <div className={styles.cardMeta}>
          {node.invested_total > 0 && (
            <span className={styles.metaItem}>
              {formatMoneyShort(node.invested_total)} in {node.deal_count === 1 ? '1 deal' : `${node.deal_count} deals`}
            </span>
          )}
          {hasChildren && (
            <span className={styles.metaBranch}>
              {node.subtree_count - 1} below
              {node.subtree_invested > node.invested_total && ` · ${formatMoneyShort(node.subtree_invested)} with branch`}
            </span>
          )}
        </div>
      </div>

      {hasChildren && open && (
        <ul className={styles.branch}>
          {node.children.map((c) => (
            <TreeNode key={c.investor_id} node={c} linkInvestors={linkInvestors} />
          ))}
        </ul>
      )}
    </li>
  )
}
