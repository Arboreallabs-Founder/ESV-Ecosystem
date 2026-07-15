import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/user'
import { createClient } from '@/lib/supabase/server'
import { fetchOpenTaskCount } from '@/lib/tasks'
import { fetchOpenEscalationCount } from '@/lib/escalations'
import { fetchBulletinPosts } from '@/lib/bulletin'
import styles from './dashboard.module.css'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Small stroke icon (Heroicons outline), matching the sidebar nav style.
function Icon({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  )
}

// The 8 most-used destinations — everything else stays reachable via the sidebar.
const QUICK_ACTIONS: Array<{ href: string; label: string; d: string; d2?: string }> = [
  { href: '/deal-desk',    label: 'Deal Desk',     d: 'M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z' },
  { href: '/pipelines',    label: 'Pipelines',     d: 'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6zM9 6h6M6 9v6M18 9v6' },
  { href: '/active-deals', label: 'Active Deals',  d: 'M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776' },
  { href: '/tasks',        label: 'Task Board',    d: 'M9 17V7m0 10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10V7m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2' },
  { href: '/companies',    label: 'Companies',     d: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21' },
  { href: '/investors',    label: 'Investors',     d: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941' },
  { href: '/bulletin',     label: 'Bulletin Board', d: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.65a25.05 25.05 0 0 1 4.66-.594m-4.66.594a20.7 20.7 0 0 1-1.62-.463m6.28-4.03a2.25 2.25 0 0 0 0-4.5m0 4.5v-4.5m0 4.5a25.05 25.05 0 0 1-4.66.594m4.66-5.094a25.05 25.05 0 0 0-4.66-.594m0 0V5.85m0 .001v3.9' },
  { href: '/escalations',  label: 'Escalations',   d: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z' },
]

async function fetchDashboardData() {
  const supabase = await createClient()
  const [
    { count: pipelineCount },
    { count: entryCount },
    { count: formCount },
    { count: activeDealCount },
    { count: companyCount },
    { data: recentEntries },
  ] = await Promise.all([
    supabase.from('pipelines').select('*', { count: 'exact', head: true }),
    supabase.from('pipeline_entries').select('*', { count: 'exact', head: true }),
    supabase.from('forms').select('*', { count: 'exact', head: true }),
    supabase.from('active_deals').select('*', { count: 'exact', head: true }).neq('deal_state', 'archived'),
    supabase.from('companies').select('*', { count: 'exact', head: true }),
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
    activeDealCount: activeDealCount ?? 0,
    companyCount: companyCount ?? 0,
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
  // Data queries run under RLS, so they can start in parallel with the user
  // lookup instead of waiting for the role check.
  const [user, data, openTasks, openEscalations, bulletinPosts] = await Promise.all([
    getUser(),
    fetchDashboardData(),
    fetchOpenTaskCount(),
    fetchOpenEscalationCount(),
    fetchBulletinPosts(),
  ])
  if (!user) redirect('/login')
  if (user.role === 'associate') redirect('/pipelines')
  if (user.role === 'franchise_partner') redirect('/portal')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user.name?.split(' ')[0] ?? ''

  const stats = [
    { label: 'Active Deals', value: data.activeDealCount, desc: 'Live (non-archived)',    href: '/active-deals' },
    { label: 'Pipelines',    value: data.pipelineCount,   desc: 'Active pipelines',        href: '/pipelines' },
    { label: 'Submissions',  value: data.entryCount,      desc: 'Total entries received',  href: '/pipelines' },
    { label: 'Companies',    value: data.companyCount,    desc: 'In the database',         href: '/companies' },
    { label: 'Open Tasks',   value: openTasks,            desc: 'Not yet done',            href: '/tasks' },
    { label: 'Escalations',  value: openEscalations,      desc: 'Open + acknowledged',     href: '/escalations' },
  ]

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  // Short status line + optional attention badge per action card.
  const actionMeta: Record<string, { desc: string; badge?: number }> = {
    '/deal-desk':    { desc: 'Review the incoming queue' },
    '/pipelines':    { desc: plural(data.pipelineCount, 'active pipeline') },
    '/active-deals': { desc: plural(data.activeDealCount, 'live deal') },
    '/tasks':        { desc: plural(openTasks, 'open task'), badge: openTasks },
    '/companies':    { desc: plural(data.companyCount, 'company') + ' tracked' },
    '/investors':    { desc: 'Fund database & outreach' },
    '/bulletin':      { desc: 'Team updates & events' },
    '/escalations':  { desc: plural(openEscalations, 'open escalation'), badge: openEscalations },
  }

  const recentBulletins = bulletinPosts.slice(0, 5)

  return (
    <>
      <div className={styles.heroBlock}>
        <h1 className={styles.greeting}>{greeting}{firstName ? `, ${firstName}` : ''}.</h1>
        <p className={styles.greetingSub}>Here&apos;s what needs attention across the ecosystem.</p>
      </div>

      {/* Quick links — the 8 most-used destinations */}
      {/* Bottom: Bulletin + Recent Activity */}
      <div className={styles.focusGrid}>
        {/* Bulletin updates */}
        <div className={styles.activityCard}>
          <div className={styles.activityHeader}>
            <span className={styles.activityTitle}>Bulletin Board</span>
            <Link href="/bulletin" className={styles.activityLink}>View all →</Link>
          </div>
          {recentBulletins.length === 0 ? (
            <div className={styles.activityEmpty}>
              No bulletin posts yet.{' '}
              <Link href="/bulletin" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Post an update</Link>.
            </div>
          ) : (
            recentBulletins.map((post) => {
              const isEvent = post.post_type === 'event'
              const badgeColor = isEvent ? '#745FFD' : '#8B6245'
              const dateLabel = isEvent && post.event_date
                ? formatDate(post.event_date) + (post.event_time ? ` · ${post.event_time}` : '')
                : formatDateTime(post.created_at)
              return (
                <div key={post.id} className={styles.activityRow}>
                  <div className={styles.activityDot} style={{ background: badgeColor }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className={styles.activityText}>
                      {post.pinned && <span className={styles.pinnedTag}>📌</span>}
                      <strong>{post.title}</strong>
                      <span className={styles.bulletinBadge} style={{ background: badgeColor + '1a', color: badgeColor }}>
                        {isEvent ? 'Event' : 'Announcement'}
                      </span>
                    </div>
                    {post.body && <div className={styles.bulletinSnippet}>{post.body}</div>}
                    <div className={styles.activityMeta}>
                      {isEvent && post.location ? `${post.location} · ` : ''}{dateLabel}
                      {post.created_by_user?.name ? ` · ${post.created_by_user.name}` : ''}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Recent submissions */}
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
                  <div style={{ minWidth: 0, flex: 1 }}>
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
      </div>

      <section className={styles.quickSection} aria-labelledby="dashboard-quick-links">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="dashboard-quick-links" className={styles.sectionTitle}>Quick links</h2>
            <p className={styles.sectionSub}>Jump to the workspaces the team uses most.</p>
          </div>
          <span className={styles.carouselHint}>Scroll sideways</span>
        </div>

        <div className={styles.actionsCarousel}>
          {QUICK_ACTIONS.map(({ href, label, d, d2 }) => {
            const meta = actionMeta[href]
            return (
              <Link key={href} href={href} className={styles.actionCard}>
                <div className={styles.actionCardTop}>
                  <span className={styles.actionIcon}><Icon d={d} d2={d2} /></span>
                  {!!meta.badge && meta.badge > 0 && <span className={styles.actionBadge}>{meta.badge}</span>}
                </div>
                <div className={styles.actionLabel}>{label}</div>
                <div className={styles.actionDesc}>{meta.desc}</div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className={styles.metricsSection} aria-labelledby="dashboard-health">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="dashboard-health" className={styles.sectionTitle}>Ecosystem health</h2>
            <p className={styles.sectionSub}>A compact read on volume and open work.</p>
          </div>
        </div>
        <div className={styles.statsGrid}>
          {stats.map(({ label, value, desc, href }) => (
            <Link key={label} href={href} className={styles.statCard}>
              <div className={styles.statLabel}>{label}</div>
              <div className={styles.statValue}>{value}</div>
              <div className={styles.statDesc}>{desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
