import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchApprovedUsers } from '@/lib/partners'
import UsersTable from './_components/UsersTable'

export default async function AdminUsersPage() {
  const user = await getUser()
  if (!user || !['founder', 'admin'].includes(user.role)) redirect('/dashboard')

  const approvedUsers = await fetchApprovedUsers()

  return <UsersTable approvedUsers={approvedUsers} currentUserEmail={user.email} />
}
