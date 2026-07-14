import LoadingShell from '@/app/_components/LoadingShell'

export default function BulletinLoading() {
  return (
    <LoadingShell contentOnly>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 760 }}>
        {[1, 2, 3].map((row) => (
          <div key={row} className="skeleton" style={{ height: 96, borderRadius: 10 }} />
        ))}
      </div>
    </LoadingShell>
  )
}
