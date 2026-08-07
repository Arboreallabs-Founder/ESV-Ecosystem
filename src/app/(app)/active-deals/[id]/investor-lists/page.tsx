import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/user'
import { createClient } from '@/lib/supabase/server'
import {
  dealIsInvestmentBanking, fetchDealSectors, fetchListsForDeal,
  fetchSelectableFunds, suggestFunds,
} from '@/lib/investor-lists'
import InvestorListsClient from './_components/InvestorListsClient'
import styles from './investor-lists.module.css'

/**
 * Investor lists for one deal.
 *
 * Gated on the Investment Banking tag. The database enforces it too — this check exists so the
 * refusal is a sentence rather than a constraint error.
 */
export default async function DealInvestorListsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate'].includes(user.role ?? '')) redirect('/active-deals')

  const supabase = await createClient()
  const { data: deal } = await supabase
    .from('active_deals')
    .select('id, entry:pipeline_entries(title, company:companies!company_id(name))')
    .eq('id', id)
    .maybeSingle()
  if (!deal) notFound()

  const entry = Array.isArray((deal as any).entry) ? (deal as any).entry[0] : (deal as any).entry
  const company = Array.isArray(entry?.company) ? entry.company[0] : entry?.company
  const dealName = company?.name ?? entry?.title ?? 'this deal'

  const isIB = await dealIsInvestmentBanking(id)
  if (!isIB) {
    return (
      <div className={styles.page}>
        <Link href={`/active-deals/${id}`} className={styles.back}>← {dealName}</Link>
        <div className={styles.gate}>
          <h1 className={styles.gateTitle}>Not an Investment Banking deal</h1>
          <p className={styles.gateBody}>
            Investor lists are only built on deals tagged <strong>Investment Banking</strong>. Add
            that category to this deal if it belongs there — the restriction is enforced in the
            database, so it applies however the list is created.
          </p>
        </div>
      </div>
    )
  }

  const [lists, funds, suggestions, dealSectors] = await Promise.all([
    fetchListsForDeal(id),
    fetchSelectableFunds(),
    suggestFunds(id),
    fetchDealSectors(id),
  ])

  return (
    <InvestorListsClient
      dealId={id}
      dealName={dealName}
      lists={lists}
      funds={funds as any}
      suggestions={suggestions}
      dealSectors={dealSectors}
    />
  )
}
