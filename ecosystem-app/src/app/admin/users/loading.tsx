import LoadingShell from '@/app/_components/LoadingShell'

export default function AdminUsersLoading() {
  return (
    <LoadingShell>
      <div className="skeleton" style={{ height: 280, borderRadius: 10 }} />
    </LoadingShell>
  )
}
