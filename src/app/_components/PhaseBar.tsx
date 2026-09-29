import { PROJECT_STAGES, STAGE_META, stageIndex, type ProjectStage } from '@/lib/project-model'
import styles from './phase-bar.module.css'

/**
 * A project's place on its path. Two sizes: `compact` is the row of dots on a list card with just
 * the current step named under it; `detailed` names every step and can carry a date under each.
 * Plain component (no state), so it renders the same on the internal pages, the partner portal and
 * the client's /pr/ link.
 */
export default function PhaseBar({ stage, variant = 'compact', dates, steps }: {
  stage: ProjectStage
  variant?: 'compact' | 'detailed'
  /** Optional caption per step, e.g. when it was reached. */
  dates?: Partial<Record<ProjectStage, string | null>>
  /** Override the steps (used for a service's own track). Defaults to the project stages. */
  steps?: Array<{ key: string; label: string; short?: string }>
}) {
  const list = steps ?? PROJECT_STAGES.map((s) => ({ key: s, label: STAGE_META[s].label, short: STAGE_META[s].short }))
  const current = steps ? list.findIndex((s) => s.key === stage) : stageIndex(stage)
  const dormant = stage === 'dormant'
  // A project is complete at 'completed'; a service track once it reaches its last step.
  const complete = steps ? current === list.length - 1 : stage === 'completed'

  return (
    <div className={`${styles.bar} ${variant === 'detailed' ? styles.detailed : styles.compact}`}
         aria-label={`Stage: ${dormant ? 'Dormant' : list[current]?.label ?? stage}`}>
      <ol className={styles.track}>
        {list.map((s, i) => {
          const state = complete || i < current ? 'done' : i === current ? (dormant ? 'stopped' : 'current') : 'todo'
          return (
            <li key={s.key} className={`${styles.step} ${styles[state]}`}>
              <span className={styles.dotRow}>
                {i > 0 && <span className={`${styles.line} ${i <= current || complete ? styles.lineDone : ''}`} />}
                <span className={styles.dot}>{state === 'done' && variant === 'detailed' ? '✓' : ''}</span>
              </span>
              {(variant === 'detailed' || i === current) && (
                <span className={styles.label}>
                  {i === current && dormant ? 'Dormant' : variant === 'detailed' ? s.label : (s.short ?? s.label)}
                  {variant === 'detailed' && dates?.[s.key as ProjectStage] && (
                    <span className={styles.date}>{dates[s.key as ProjectStage]}</span>
                  )}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
