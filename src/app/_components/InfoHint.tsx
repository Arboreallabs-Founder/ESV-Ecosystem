'use client'

/**
 * Small "i" affordance explaining a field.
 *
 * Uses the native `title` tooltip rather than a custom popover: it works on hover, on keyboard
 * focus, and is read by screen readers for free — a hand-rolled div would need all three
 * rebuilding, and this is a one-line explainer, not rich content.
 */
export default function InfoHint({ text }: { text: string }) {
  return (
    <span
      className="infoHint"
      title={text}
      aria-label={text}
      role="img"
      tabIndex={0}
    >
      i
    </span>
  )
}
