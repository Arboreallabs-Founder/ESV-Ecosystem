import LoadingShell from '@/app/_components/LoadingShell'

export default function PipelineLoading() {
  return (
    <LoadingShell>
      <div style={{ display: 'flex', gap: '1rem', overflowX: 'hidden' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ flex: '0 0 260px' }}>
            <div className="skeleton" style={{ height: 40, borderRadius: 10, marginBottom: '0.75rem' }} />
            {[1, 2, 3].map((j) => (
              <div key={j} className="skeleton" style={{ height: 90, borderRadius: 10, marginBottom: '0.625rem' }} />
            ))}
          </div>
        ))}
      </div>
    </LoadingShell>
  )
}
