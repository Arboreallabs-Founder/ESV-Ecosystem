import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { getMyEarnings } from '@/app/actions/partners'
import styles from './earnings.module.css'

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function MyEarningsPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (user.role !== 'franchise_partner') redirect('/active-deals')

  const deals = await getMyEarnings()
  const total = deals.reduce((s, d) => s + d.share_amount, 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.pageTitle}>My Earnings</div>
        <div className={styles.pageSub}>
          Your share of each deal you sourced or referred an investing investor to.
        </div>
      </div>

      {deals.length === 0 ? (
        <div className={styles.empty}>
          No earnings yet. Once a deal you sourced is accepted — or one of your referred investors
          invests — your share will appear here.
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
                  <th>Your Split</th>
                  <th>Your Earning</th>
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
    </div>
  )
}
