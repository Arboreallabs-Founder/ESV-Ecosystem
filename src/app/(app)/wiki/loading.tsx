import LoadingShell from '@/app/_components/LoadingShell'

export default function WikiLoading() {
  return (
    <LoadingShell contentOnly>
      <div style={{ display: 'flex', gap: '2rem' }}>
        <div style={{ width: 200, flexShrink: 0 }}>
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 20, borderRadius: 6, marginBottom: '0.6rem' }} />)}
        </div>
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: '60%', height: 24, marginBottom: '1.25rem' }} />
          {[100, 95, 88, 92, 70].map((w, i) => <div key={i} className="skeleton" style={{ width: `${w}%`, height: 12, marginBottom: '0.7rem' }} />)}
        </div>
      </div>
    </LoadingShell>
  )
}
