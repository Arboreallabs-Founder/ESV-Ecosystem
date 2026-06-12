import LoadingShell from '@/app/_components/LoadingShell'

export default function PipelineBoardLoading() {
  return (
    <LoadingShell contentOnly>
      <div style={{ display: 'flex', gap: '1rem', overflow: 'hidden' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ width: 272, flexShrink: 0, height: 320, borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
    </LoadingShell>
  )
}
