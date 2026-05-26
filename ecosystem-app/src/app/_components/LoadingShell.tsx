export default function LoadingShell({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Sidebar skeleton */}
      <div className="skeletonSidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-primary)', opacity: 0.25 }} />
          <div className="skeleton" style={{ width: 80, height: 14 }} />
        </div>
        <div className="skeleton" style={{ width: '40%', height: 10, marginBottom: '0.75rem', opacity: 0.5 }} />
        {[70, 90, 80, 95, 65, 75].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: `${w}%`, height: 32, borderRadius: 8 }} />
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '2rem 2.25rem', minWidth: 0 }}>
        <div className="skeleton" style={{ width: 200, height: 28, marginBottom: '0.5rem' }} />
        <div className="skeleton" style={{ width: 300, height: 14, marginBottom: '2rem' }} />
        {children}
      </div>
    </div>
  )
}
