import { HEALTH_COLORS, explainHealth, type MandateHealth } from '@/lib/mandate-health'
import styles from './health-badge.module.css'

/**
 * A mandate's health, as a band and a sentence.
 *
 * The sentence matters more than the number. A score on its own invites arguing with the formula;
 * "3 in conversation, 2 gone quiet of 8" is something somebody can act on this afternoon. The
 * number is there so mandates can be compared, and the tooltip explains how it was reached so
 * nobody has to take it on faith.
 */
export default function HealthBadge({ health, compact = false }: {
  health: MandateHealth
  compact?: boolean
}) {
  const colour = HEALTH_COLORS[health.band]

  if (health.score === null) {
    return <span className={styles.empty}>{health.label}</span>
  }

  return (
    <span className={compact ? styles.compact : styles.badge} title={explainHealth()}>
      <span
        className={styles.pill}
        style={{ color: colour, borderColor: `${colour}55`, background: `${colour}14` }}
      >
        {health.label}
        <span className={styles.score}>{health.score}</span>
      </span>
      {!compact && <span className={styles.summary}>{health.summary}</span>}
    </span>
  )
}
