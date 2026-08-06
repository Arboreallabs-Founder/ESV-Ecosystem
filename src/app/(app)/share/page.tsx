import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchShareableForms, fetchShareLinks } from '@/lib/share-links'
import ShareClient from './_components/ShareClient'

/**
 * Share links — issue your own /f/[token] link, get a QR for it, and see what it produced.
 *
 * Open to everyone who can already create a link (the form_links RLS policy allows founder,
 * admin, associate and partners). It exists because the ability was there but had nowhere
 * obvious to be used: link issuing lived on /forms next to Edit/Build, which reads as an
 * admin surface, so in practice only founders and admins ever issued one.
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')
  if (!['founder', 'admin', 'associate'].includes(user.role ?? '')) redirect('/dashboard')

  const { scope } = await searchParams
  const isLead = ['founder', 'admin'].includes(user.role ?? '')
  // Only leads may widen past their own links; anyone else is pinned to `mine` regardless of URL.
  const mine = !isLead || scope !== 'all'

  const [forms, links] = await Promise.all([
    fetchShareableForms(),
    fetchShareLinks(user.id, mine),
  ])

  return (
    <ShareClient
      forms={forms}
      links={links}
      canSeeAll={isLead}
      scope={mine ? 'mine' : 'all'}
      currentUserId={user.id}
    />
  )
}
