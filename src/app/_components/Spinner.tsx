// Reusable spinner for non-page-load states (button submits, inline fetches, transitions).
// Page-level empty states use LoadingShell skeletons instead.
export default function Spinner({
  size = 18,
  label,
  center = false,
  className = '',
}: {
  size?: number
  label?: string
  center?: boolean          // render a centered block that fills its container
  className?: string
}) {
  const spinner = (
    <span
      className={`spinner ${className}`}
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 9)) }}
      role="status"
      aria-label={label ?? 'Loading'}
    />
  )

  if (center) {
    return (
      <div className="spinnerCenter">
        {spinner}
        {label && <span>{label}</span>}
      </div>
    )
  }
  return spinner
}
