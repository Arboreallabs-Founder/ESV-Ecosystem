import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchDealBook } from '@/lib/deal-book'
import DealBookClient from './_components/DealBookClient'

export default async function DealBookPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general', 'hr'].includes(user.role ?? '')) redirect('/dashboard')

  let data: Awaited<ReturnType<typeof fetchDealBook>> | null = null
  try { data = await fetchDealBook() } catch (e) { console.error('[deal-book] page load failed:', e) }

  return (
    <DealBookClient
      rows={data?.rows ?? []}
      settings={data?.settings ?? null}
      canManage={['founder', 'admin'].includes(user.role ?? '')}
      orgId={user.org_id ?? ''}
    />
  )
}
