import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import WikiClient from './_components/WikiClient'

/**
 * The full wiki, scoped to the caller.
 *
 * The role is resolved here rather than in the browser: a partner should not be shipped the
 * internal sections and told not to look at them.
 */
export default async function WikiPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  return <WikiClient role={user.role ?? null} />
}
