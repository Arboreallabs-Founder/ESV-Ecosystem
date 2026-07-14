import LoadingShell from '@/app/_components/LoadingShell'

export default function RecurringTasksLoading() {
  return (
    <LoadingShell contentOnly>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 720 }}>
        {[1, 2, 3].map((row) => (
          <div key={row} className="skeleton" style={{ height: 84, borderRadius: 10 }} />
        ))}
      </div>
    </LoadingShell>
  )
}
