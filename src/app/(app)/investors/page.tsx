import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchAllInvestors } from '@/lib/investors'
import InvestorTable from './_components/InvestorTable'

export default async function InvestorsPage() {
  const [user, investors] = await Promise.all([getUser(), fetchAllInvestors()])
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')

  return <InvestorTable investors={investors} userRole={user.role} />
}
