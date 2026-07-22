import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchInvestorEditLog } from '@/lib/investors'
import InvestorEditLogClient from './_components/InvestorEditLogClient'

export default async function InvestorEditLogPage() {
  const user = await getUser()
  if (!user || !['founder', 'admin'].includes(user.role)) redirect('/dashboard')

  const entries = await fetchInvestorEditLog()
  return <InvestorEditLogClient entries={entries} />
}
