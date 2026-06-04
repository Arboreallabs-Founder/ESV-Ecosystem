import LoadingShell from '@/app/_components/LoadingShell'

export default function FormsLoading() {
  return (
    <LoadingShell>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    </LoadingShell>
  )
}
