import LoadingShell from '@/app/_components/LoadingShell'

export default function CompaniesLoading() {
  return (
    <LoadingShell contentOnly>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton" style={{ height: 150, borderRadius: 16 }} />)}
      </div>
    </LoadingShell>
  )
}
