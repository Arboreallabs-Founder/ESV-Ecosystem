'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import FilterTabs from '@/app/_components/FilterTabs'
import PhaseBar from '@/app/_components/PhaseBar'
import { AvatarGroup } from '@/app/_components/Avatar'
import type { PickablePerson } from '@/app/_components/PeoplePicker'
import { STAGE_META, serviceLabel, trackFor, type ProjectSummary } from '@/lib/project-model'
import NewProjectModal from './NewProjectModal'
import styles from '../projects.module.css'

type Filter = 'open' | 'dormant' | 'completed' | 'all'

const isOpen = (p: ProjectSummary) => p.stage !== 'dormant' && p.stage !== 'completed'

function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export default function ProjectsList({ projects, people, companyOptions, userId, canCreate }: {
  projects: ProjectSummary[]
  people: PickablePerson[]
  companyOptions: Array<{ id: string; name: string }>
  userId: string
  canCreate: boolean
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('open')
  const [mine, setMine] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const counts = useMemo(() => ({
    open: projects.filter(isOpen).length,
    dormant: projects.filter((p) => p.stage === 'dormant').length,
    completed: projects.filter((p) => p.stage === 'completed').length,
    all: projects.length,
  }), [projects])

  const shown = projects
    .filter((p) => filter === 'all' || (filter === 'open' ? isOpen(p) : p.stage === filter))
    .filter((p) => !mine || p.members.some((m) => m.user_id === userId))
    .filter((p) => {
      const q = query.trim().toLowerCase()
      return !q || p.name.toLowerCase().includes(q) || (p.company?.name ?? '').toLowerCase().includes(q)
    })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.pageTitle}>Projects</div>
          <div className={styles.pageSub}>
            Prefunding engagements, from the first call to handover: pitch decks, projections,
            valuations, market research and datarooms.
          </div>
        </div>
        {canCreate && (
          <div className={styles.headerActions}>
            <button className={styles.primaryBtn} onClick={() => setCreating(true)}>+ New project</button>
          </div>
        )}
      </div>

      <div className={styles.toolbar}>
        <FilterTabs
          tabs={[
            { value: 'open', label: 'In flight', count: counts.open },
            { value: 'dormant', label: 'Dormant', count: counts.dormant },
            { value: 'completed', label: 'Completed', count: counts.completed },
            { value: 'all', label: 'All', count: counts.all },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />
        <label className={styles.mineToggle}>
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          Only mine
        </label>
        <input className={styles.search} placeholder="Search projects…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {shown.length === 0 ? (
        <div className={styles.empty}>
          {projects.length === 0
            ? 'No projects yet. Start one when a founder asks about decks, projections or a valuation.'
            : 'Nothing matches these filters.'}
        </div>
      ) : (
        <div className={styles.grid}>
          {shown.map((p) => {
            const lead = p.members.filter((m) => m.role === 'lead')
            const team = [...new Map(p.members.map((m) => [m.user_id, m])).values()]
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className={styles.card}>
                <div className={styles.cardTop}>
                  {p.company?.logo_url
                    // eslint-disable-next-line @next/next/no-img-element -- small remote logo, same as company cards
                    ? <img src={p.company.logo_url} alt="" className={styles.logo} />
                    : <span className={styles.logoFallback}>{p.name.slice(0, 1).toUpperCase()}</span>}
                  <div className={styles.cardTitleWrap}>
                    <div className={styles.cardTitle}>{p.name}</div>
                    <div className={styles.cardMeta}>
                      {STAGE_META[p.stage].label} · {daysSince(p.stage_changed_at)}d in stage
                      {p.partner && <span className={styles.partnerTag}>{p.partner.name}</span>}
                    </div>
                  </div>
                </div>

                <PhaseBar stage={p.stage} />

                {p.services.length > 0 && (
                  <div className={styles.serviceChips}>
                    {p.services.map((s) => {
                      const track = trackFor(s.service)
                      const at = track.find((t) => t.step === s.step)
                      return (
                        <span key={s.id} className={`${styles.serviceChip} ${s.step === 'final' ? styles.serviceChipDone : ''}`}>
                          {serviceLabel(s.service, s.label)}
                          {(p.stage === 'work' || p.stage === 'handover') && at && s.step !== 'not_started' && (
                            <span className={styles.serviceChipStep}> · {at.label}</span>
                          )}
                        </span>
                      )
                    })}
                  </div>
                )}

                <div className={styles.cardFoot}>
                  <AvatarGroup people={team.map((m) => ({ id: m.user_id, name: m.name, email: m.email, photo_url: m.photo_url }))} size="xs" max={5} />
                  <span className={styles.cardFootText}>
                    {p.stage === 'data' && p.checklist_total > 0
                      ? `Data ${p.checklist_done}/${p.checklist_total}`
                      : lead.length ? `Lead: ${lead.map((m) => m.name?.split(' ')[0]).join(', ')}` : 'No lead yet'}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {creating && (
        <NewProjectModal
          people={people}
          companyOptions={companyOptions}
          userId={userId}
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); router.push(`/projects/${id}`) }}
        />
      )}
    </div>
  )
}
