import Spinner from '@/app/_components/Spinner'

// Public form is standalone (no app shell) — a centered spinner while it loads.
export default function PublicFormLoading() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <Spinner size={32} label="Loading form…" center />
    </div>
  )
}
