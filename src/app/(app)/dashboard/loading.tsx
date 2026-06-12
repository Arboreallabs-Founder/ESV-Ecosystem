import LoadingShell from '@/app/_components/LoadingShell'

export default function DashboardLoading() {
  return (
    <LoadingShell contentOnly>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 280, borderRadius: 16 }} />
    </LoadingShell>
  )
}
