import LoadingShell from '@/app/_components/LoadingShell'

export default function PortalLoading() {
  return (
    <LoadingShell contentOnly>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16 }} />)}
      </div>
    </LoadingShell>
  )
}
