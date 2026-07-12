import LoadingShell from '@/app/_components/LoadingShell'

export default function SuperAdminOrgsLoading() {
  return (
    <LoadingShell contentOnly>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12, marginBottom: '0.75rem' }} />
      ))}
    </LoadingShell>
  )
}
