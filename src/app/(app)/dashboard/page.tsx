import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/user'
import { createClient } from '@/lib/supabase/server'
import { fetchOpenTaskCount } from '@/lib/tasks'
import styles from './dashboard.module.css'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

async function fetchDashboardData() {
  const supabase = await createClient()
  const [
    { count: pipelineCount },
    { count: entryCount },
    { count: formCount },
    { data: recentEntries },
  ] = await Promise.all([
    supabase.from('pipelines').select('*', { count: 'exact', head: true }),
    supabase.from('pipeline_entries').select('*', { count: 'exact', head: true }),
    supabase.from('forms').select('*', { count: 'exact', head: true }),
    supabase
      .from('pipeline_entries')
      .select('id, title, submitter_name, submitter_email, submitted_at, updated_at, form:forms(title), pipeline:pipelines(name), stage:pipeline_stages(name, stage_type)')
      .order('updated_at', { ascending: false })
      .limit(8),
  ])

  return {
    pipelineCount: pipelineCount ?? 0,
    entryCount: entryCount ?? 0,
    formCount: formCount ?? 0,
    recentEntries: (recentEntries ?? []) as unknown as Array<{
      id: string
      title: string | null
      submitter_name: string | null
      submitter_email: string | null
      submitted_at: string
      updated_at: string
      form: { title: string } | null
      pipeline: { name: string } | null
      stage: { name: string; stage_type: string } | null
    }>,
  }
}

export default async function DashboardPage() {
  const user = await getUser()
  if (!user) redirect('/login')
  if (user.role === 'associate') redirect('/pipelines')
  if (user.role === 'franchise_partner') redirect('/portal')

  const [data, openTasks] = await Promise.all([fetchDashboardData(), fetchOpenTaskCount()])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user.name?.split(' ')[0] ?? ''

  const stats = [
    { label: 'Pipelines',   value: data.pipelineCount, desc: 'Active pipelines',     href: '/pipelines' },
    { label: 'Submissions', value: data.entryCount,    desc: 'Total entries received', href: '/pipelines' },
    { label: 'Forms',       value: data.formCount,     desc: 'Forms created',         href: '/forms' },
    { label: 'Open Tasks',  value: openTasks,          desc: 'To Do + In Progress',   href: '/tasks' },
  ]

  const quickLinks = [
    { href: '/pipelines', label: 'Pipelines', action: 'View all →' },
    { href: '/forms',     label: 'Forms',     action: 'Build a form →' },
    { href: '/tasks',     label: 'Tasks',     action: `${openTasks} open →` },
  ]

  return (
    <>
      <h1 className={styles.greeting}>{greeting}{firstName ? `, ${firstName}` : ''}.</h1>
      <p className={styles.greetingSub}>Here&apos;s an overview of your pipelines and submissions.</p>

      <div className={styles.statsGrid}>
        {stats.map(({ label, value, desc, href }) => (
          <Link key={label} href={href} className={styles.statCard}>
            <div className={styles.statLabel}>{label}</div>
            <div className={styles.statValue}>{value}</div>
            <div className={styles.statDesc}>{desc}</div>
          </Link>
        ))}
      </div>

      <div className={styles.quickGrid}>
        {quickLinks.map(({ href, label, action }) => (
          <Link key={href} href={href} className={styles.quickCard}>
            <div className={styles.quickLabel}>{label}</div>
            <div className={styles.quickAction}>{action}</div>
          </Link>
        ))}
      </div>

      <div className={styles.activityCard}>
        <div className={styles.activityHeader}>
          <span className={styles.activityTitle}>Recent Activity</span>
          <Link href="/pipelines" className={styles.activityLink}>View pipelines →</Link>
        </div>

        {data.recentEntries.length === 0 ? (
          <div className={styles.activityEmpty}>
            No submissions yet.{' '}
            <Link href="/forms" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Create a form</Link>
            {' '}and share it to start receiving entries.
          </div>
        ) : (
          data.recentEntries.map((entry) => {
            const wasMoved = entry.updated_at && entry.updated_at !== entry.submitted_at &&
              new Date(entry.updated_at).getTime() - new Date(entry.submitted_at).getTime() > 5000
            const stageType = entry.stage?.stage_type
            const stageDotColor = stageType === 'accepted' ? '#16a34a' : stageType === 'rejected' ? '#dc2626' : 'var(--color-primary)'
            return (
              <div key={entry.id} className={styles.activityRow}>
                <div className={styles.activityDot} style={{ background: stageDotColor }} />
                <div>
                  <div className={styles.activityText}>
                    <strong>{entry.title || 'Untitled submission'}</strong>
                    {entry.pipeline && <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}> · {entry.pipeline.name}</span>}
                    {entry.stage && (
                      <span style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.1rem 0.4rem',
                        borderRadius: 4,
                        background: stageDotColor + '1a',
                        color: stageDotColor,
                      }}>
                        {entry.stage.name}
                      </span>
                    )}
                  </div>
                  <div className={styles.activityMeta}>
                    {entry.submitter_name || entry.submitter_email || 'Anonymous'}
                    {entry.form ? ` · via ${entry.form.title}` : ''}
                    {' · '}{wasMoved ? `moved ${formatDateTime(entry.updated_at)}` : `submitted ${formatDateTime(entry.submitted_at)}`}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
