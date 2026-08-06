import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchForms } from '@/lib/forms'
import { fetchPipelines } from '@/lib/pipelines'
import { fetchShareableForms, fetchShareLinks } from '@/lib/share-links'
import FormsShell from './_components/FormsShell'

/**
 * Forms, with Share as its second tab — building a form and handing it out are the same job.
 *
 * Share data is only fetched when that tab is open: it counts submissions per link and renders a
 * QR for each one, which is real work to do for someone who came here to edit a form.
 */
export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; scope?: string }>
}) {
  const { tab: tabParam, scope } = await searchParams
  const user = await getUser()
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')

  // Building/linking forms is open to associates too; deleting a form or an issued link stays admin-only.
  const canBuild = ['founder', 'admin', 'associate'].includes(user.role ?? '')
  const canDelete = ['founder', 'admin'].includes(user.role ?? '')
  const canShare = canBuild
  const tab = tabParam === 'share' && canShare ? 'share' : 'forms'

  const isLead = ['founder', 'admin'].includes(user.role ?? '')
  // Only leads may widen past their own links; anyone else is pinned to `mine` regardless of URL.
  const mine = !isLead || scope !== 'all'

  const [forms, pipelines, shareForms, shareLinks] = await Promise.all([
    fetchForms(),
    fetchPipelines(),
    tab === 'share' ? fetchShareableForms() : Promise.resolve([]),
    tab === 'share' ? fetchShareLinks(user.id, mine) : Promise.resolve([]),
  ])

  return (
    <FormsShell
      tab={tab}
      forms={forms}
      pipelines={pipelines}
      canBuild={canBuild}
      canDelete={canDelete}
      canShare={canShare}
      shareForms={shareForms}
      shareLinks={shareLinks}
      canSeeAll={isLead}
      scope={mine ? 'mine' : 'all'}
      currentUserId={user.id}
    />
  )
}
