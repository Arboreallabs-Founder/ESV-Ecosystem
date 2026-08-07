import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { fetchEmployeeRoster } from '@/lib/employees'
import { fetchStatementsForMonth, fetchMyStatements, monthKey, recentMonths } from '@/lib/attendance'
import AttendanceAdmin from './_components/AttendanceAdmin'
import MyAttendance from './_components/MyAttendance'

/**
 * Monthly attendance statements.
 *
 * Role-branched on one route, the way /deal-desk is: managers get the whole month, everyone else
 * gets their own statements. Two routes would mean two places to remember.
 */
const MANAGERS = ['founder', 'admin', 'hr']

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/login')
  if (user.role === 'franchise_partner') redirect('/portal')

  const { month } = await searchParams
  const months = recentMonths(12)
  const period = month && months.includes(month) ? month : monthKey()

  if (MANAGERS.includes(user.role ?? '')) {
    const [statements, roster] = await Promise.all([
      fetchStatementsForMonth(period),
      fetchEmployeeRoster(),
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
      />
    )
  }

  const mine = await fetchMyStatements(user.id)
  return <MyAttendance statements={mine} />
}
