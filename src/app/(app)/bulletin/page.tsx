import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchBulletinPosts } from '@/lib/bulletin'
import BulletinBoardView from './_components/BulletinBoardView'

export default async function BulletinPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (!['founder', 'admin', 'associate', 'general'].includes(user.role ?? '')) redirect('/dashboard')

  const posts = await fetchBulletinPosts()
  const isAdmin = ['founder', 'admin'].includes(user.role ?? '')

  return <BulletinBoardView posts={posts} isAdmin={isAdmin} currentUserId={user.id} />
}
