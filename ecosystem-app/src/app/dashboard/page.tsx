import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fetchDashboardStats } from '@/lib/deals'
import { fetchOpenTaskCount } from '@/lib/tasks'
import AppShell from '@/app/_components/AppShell'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const STAT_CARDS = [
  { key: 'activeDeals', label: 'Active Deals', desc: 'Not yet closed' },
  { key: 'inMandate', label: 'In Mandate', desc: 'Mandate accepted' },
  { key: 'closedTotal', label: 'Total Closed', desc: 'Success + dead' },
  { key: 'openTasks', label: 'Open Tasks', desc: 'To Do + In Progress' },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('name, role, email')
    .eq('id', user.id)
    .single()

  const role = userData?.role
  if (role === 'associate') redirect('/pipeline')
  if (role === 'franchise_partner') redirect('/portal')

  const [stats, openTasks] = await Promise.all([
    fetchDashboardStats(),
    fetchOpenTaskCount(),
  ])

  const statValues: Record<string, number> = {
    activeDeals: stats.activeDeals,
    inMandate: stats.inMandate,
    closedTotal: stats.closedTotal,
    openTasks,
  }

  return (
    <AppShell user={userData ?? { name: user.email, role: 'founder', email: user.email }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
        Good morning{userData?.name ? `, ${userData.name.split(' ')[0]}` : ''}.
      </h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Here&apos;s what&apos;s happening across the pipeline today.
      </p>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {STAT_CARDS.map(({ key, label, desc }) => (
          <div
            key={key}
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem 1.5rem',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600, marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {label}
            </div>
            <div style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {statValues[key]}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.375rem' }}>{desc}</div>
          </div>
        ))}

        {/* Quick links */}
        <Link
          href="/pipeline"
          style={{
            background: 'rgba(116,95,253,0.08)',
            border: '1.5px solid rgba(116,95,253,0.25)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            textDecoration: 'none',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.375rem' }}>
            Pipeline
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)' }}>View All Deals →</div>
        </Link>
        <Link
          href="/tasks"
          style={{
            background: 'rgba(116,95,253,0.05)',
            border: '1.5px solid rgba(116,95,253,0.15)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            textDecoration: 'none',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.375rem' }}>
            Tasks
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)' }}>{openTasks} open →</div>
        </Link>
      </div>

      {/* Recent activity */}
      <div
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>Recent Activity</span>
          <Link href="/pipeline" style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 500 }}>View pipeline →</Link>
        </div>

        {stats.recentActivity.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
            No activity yet. Create your first deal in the pipeline.
          </div>
        ) : (
          <div>
            {stats.recentActivity.map((entry, i) => (
              <div
                key={entry.id}
                style={{
                  padding: '0.875rem 1.5rem',
                  borderBottom: i < stats.recentActivity.length - 1 ? '1px solid var(--color-border)' : 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.875rem',
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--color-primary)', opacity: 0.6,
                  marginTop: '0.4rem', flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 500 }}>
                    <strong>{entry.deal?.company_name ?? 'Unknown deal'}</strong>
                    {entry.from_stage
                      ? ` moved to ${entry.to_stage}`
                      : ` added at ${entry.to_stage}`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
                    {entry.changer?.name ?? 'Unknown'} · {formatDateTime(entry.changed_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
