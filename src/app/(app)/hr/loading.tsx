import LoadingShell from '@/app/_components/LoadingShell'

export default function HrZoneLoading() {
  return (
    <LoadingShell contentOnly>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxWidth: 780 }}>
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="skeleton" style={{ height: 56, borderRadius: 10 }} />
        ))}
      </div>
    </LoadingShell>
  )
}
