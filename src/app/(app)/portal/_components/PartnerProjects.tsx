import PhaseBar from '@/app/_components/PhaseBar'
import Avatar from '@/app/_components/Avatar'
import { STAGE_META, trackFor, type ProjectStage } from '@/lib/project-model'
import type { PartnerProject } from '@/lib/projects'
import styles from '../portal.module.css'

/** Prefunding projects a founder/admin credited to this partner (20261014000000): where each one
    is and how each deliverable is going. Read-only, and nothing internal (no prices or notes). */
export default function PartnerProjects({ projects }: { projects: PartnerProject[] }) {
  if (projects.length === 0) return null
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Projects you brought in <span className={styles.sectionCount}>{projects.length}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '0.75rem' }}>
        {projects.map((p) => (
          <div key={p.id} style={{
            display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '0.9rem 1rem',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-card)',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)' }}>{p.company ?? p.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.1rem' }}>
                {STAGE_META[p.stage as ProjectStage].label}
                {p.services.length > 0 && <> · {p.services.map((s) => s.label).join(', ')}</>}
              </div>
            </div>
            <PhaseBar stage={p.stage as ProjectStage} />
            {['work', 'handover'].includes(p.stage) && p.services.map((s) => (
              <div key={s.label} style={{ fontSize: '0.75rem', color: 'var(--color-text)' }}>
                <strong>{s.label}:</strong> {trackFor(s.service).find((t) => t.step === s.step)?.label}
              </div>
            ))}
            {p.contact && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                <Avatar name={p.contact.name} email={p.contact.email} photoUrl={p.contact.photo_url} size="xs" />
                ESV lead: {p.contact.name}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
