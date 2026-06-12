export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--color-bg)', overflow: 'hidden' }}>
      {children}
    </div>
  )
}
