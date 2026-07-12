import LoadingShell from '@/app/_components/LoadingShell'

export default function EarningsLoading() {
  return (
    <LoadingShell contentOnly>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 16 }} />)}
      </div>
      {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 12, marginBottom: '0.75rem' }} />)}
    </LoadingShell>
  )
}
