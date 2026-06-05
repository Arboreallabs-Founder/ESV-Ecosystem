import LoadingShell from '@/app/_components/LoadingShell'

export default function TasksLoading() {
  return (
    <LoadingShell>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
        {[1, 2, 3].map((col) => (
          <div key={col} className="skeleton" style={{ height: 360, borderRadius: 10 }} />
        ))}
      </div>
    </LoadingShell>
  )
}
