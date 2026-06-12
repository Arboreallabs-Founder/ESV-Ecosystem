import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchApprovedUsers } from '@/lib/partners'
import UsersTable from './_components/UsersTable'

export default async function AdminUsersPage() {
  const [user, approvedUsers] = await Promise.all([getUser(), fetchApprovedUsers()])
  if (!user || !['founder', 'admin'].includes(user.role)) redirect('/dashboard')

  return <UsersTable approvedUsers={approvedUsers} currentUserEmail={user.email} />
}
