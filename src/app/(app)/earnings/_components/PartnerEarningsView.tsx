import PartnerReferralTree from '../../admin/partners/_components/PartnerReferralTree'
import type { MyDealEarning, PartnerReferralTreeNode } from '@/lib/types'
import styles from '../earnings.module.css'

/**
 * A partner's own earnings page, exactly as they see it.
 *
 * Rendered in two places: /earnings for the partner, and behind "See their view" on
 * /admin/partners/[partnerId] for an admin. One component rather than two, so the preview cannot
 * drift from the real page — an admin answering "what does Robin actually see" needs the answer to
 * still be true next month, and a second copy of this markup would quietly stop being true the
 * first time either side was edited.
 *
 * Deliberately narrow. The partner sees their own share and nothing else: no org totals, no base
 * selector, no other partners, no investor rows. That narrowness is the product decision
 * (20260725000000), so showing an admin something richer *in this view* would misrepresent it. The
 * full picture is the table underneath on the admin page.
 */
export default function PartnerEarningsView({
  partnerName,
  deals,
  tree,
  /** First person for the partner's own page, third person for an admin looking at theirs. */
  voice = 'first',
}: {
  partnerName: string
  deals: MyDealEarning[]
  tree: PartnerReferralTreeNode[]
  voice?: 'first' | 'third'
}) {
  const total = deals.reduce((s, d) => s + d.share_amount, 0)
  const they = voice === 'first' ? 'Your' : 'Their'
  const them = voice === 'first' ? 'you' : 'they'

  return (
    <>
      <section className={styles.treeSection}>
        <h2 className={styles.sectionTitle}>{they} referral tree</h2>
        {/* No investor links: a partner cannot open a fund record, so the preview must not
            either — a link that works for the admin and 404s for the partner is not a preview. */}
        <PartnerReferralTree partnerName={partnerName} rows={tree} />
      </section>

      {deals.length === 0 ? (
        <div className={styles.empty}>
          No earnings yet. Once a deal {them} sourced is accepted — or one of {they.toLowerCase()}{' '}
          referred investors is added to a deal — {them === 'you' ? 'your' : 'their'} share will
          appear here.
        </div>
      ) : (
        <>
          <div className={styles.totalCard}>
            <span className={styles.totalLabel}>Total Earnings</span>
            <span className={styles.totalValue}>{formatINR(total)}</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Accepted</th>
                  <th>{they} Split</th>
                  <th>{they} Earning</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.active_deal_id}>
                    <td><span className={styles.dealName}>{d.deal_title || 'Untitled'}</span></td>
                    <td className={styles.muted}>{formatDate(d.accepted_at)}</td>
                    <td className={styles.muted}>{d.split_pct}%</td>
                    <td><span className={styles.amount}>{formatINR(d.share_amount)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
