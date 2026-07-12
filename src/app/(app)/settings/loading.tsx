import LoadingShell from '@/app/_components/LoadingShell'

export default function SettingsLoading() {
  return (
    <LoadingShell contentOnly>
      <div style={{ maxWidth: 560 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ marginBottom: '1.5rem' }}>
            <div className="skeleton" style={{ width: 120, height: 12, marginBottom: '0.5rem' }} />
            <div className="skeleton" style={{ height: 42, borderRadius: 10 }} />
          </div>
        ))}
      </div>
    </LoadingShell>
  )
}
