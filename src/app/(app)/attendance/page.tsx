import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchEmployeeRoster } from '@/lib/employees'
import { fetchStatementsForMonth, fetchMyStatements, monthKey, recentMonths } from '@/lib/attendance'
import AttendanceAdmin from './_components/AttendanceAdmin'
import MyAttendance from './_components/MyAttendance'

/**
 * Monthly attendance statements.
 *
 * Role-branched on one route, the way /deal-desk is. Managers get a Team tab AND a My attendance
 * tab: a manager is also an employee with a statement of their own, and the first version branched
 * exclusively, so HR and admins could never see — let alone approve — their own month.
 */
const MANAGERS = ['founder', 'admin', 'hr']

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tab?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')

  const { month, tab } = await searchParams
  const months = recentMonths(12)
  const period = month && months.includes(month) ? month : monthKey()

  if (MANAGERS.includes(user.role ?? '')) {
    const [statements, roster, mine] = await Promise.all([
      fetchStatementsForMonth(period),
      fetchEmployeeRoster(),
      fetchMyStatements(user.id),
    ])
    return (
      <AttendanceAdmin
        period={period}
        months={months}
        statements={statements}
        roster={roster.rows.map((r) => ({
          id: r.user.id,
          name: r.user.name ?? 'Unknown',
          photo_url: r.user.photo_url ?? null,
        }))}
        currentUserId={user.id}
        tab={tab === 'mine' ? 'mine' : 'team'}
        myStatements={mine}
      />
    )
  }

  const mine = await fetchMyStatements(user.id)
  return <MyAttendance statements={mine} />
}
