import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { getMyEarnings, getMyReferralTree } from '@/app/actions/partners'
import PartnerEarningsView from './_components/PartnerEarningsView'
import styles from './earnings.module.css'

export default async function MyEarningsPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (user.role !== 'franchise_partner') redirect('/active-deals')

  // Independent queries; neither should wait on the other.
  const [deals, tree] = await Promise.all([getMyEarnings(), getMyReferralTree()])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.pageTitle}>My Earnings</div>
        <div className={styles.pageSub}>
          Your share of each deal you sourced or referred an investor to.
        </div>
      </div>

      {/* The body lives in a component an admin can render too, so "what does this partner see"
          has one answer rather than two that drift. */}
      <PartnerEarningsView partnerName={user.name || 'You'} deals={deals} tree={tree} />
    </div>
  )
}
