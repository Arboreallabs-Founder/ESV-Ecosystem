import LoadingShell from '@/app/_components/LoadingShell'

export default function MyTodosLoading() {
  return (
    <LoadingShell contentOnly>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 640 }}>
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="skeleton" style={{ height: 52, borderRadius: 10 }} />
        ))}
      </div>
    </LoadingShell>
  )
}
